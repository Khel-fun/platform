// ---------------------------------------------------------------------------
// Card Wars proof queue
//
// Durable, Redis-backed (BullMQ) job queue for the shuffle proof pipeline.
// A job carries the shuffle inputs; the worker:
//   1. generates the UltraHonk proof          (generateShuffleProof)
//   2. persists the proof record + players     (idempotent)
//   3. submits the proof to the Kurier relayer  (submitProof)
//   4. records the verification job and runs an initial Kurier → DB sync
//
// Proof generation is CPU/memory heavy, so the worker runs at concurrency 1.
// Jobs retry with exponential backoff; the generated proof is checkpointed onto
// the job so retries resume at submission instead of re-proving.
// ---------------------------------------------------------------------------

import { Queue, Worker, type Job } from "bullmq";
import Redis from "ioredis";
import prisma from "@platform/db";
import { env } from "@platform/env/server";
import {
  generateShuffleProof,
  submitProof,
} from "@platform/proving-setup/proving";
import { CircuitKind } from "@platform/proving-setup";
import { syncKurierJobToDatabase } from "./kurier_sync";
import { createLogger } from "@platform/config/logger";

const log = createLogger("card-wars-proof-queue");

// ---------------------------------------------------------------------------
// 1. Connection & Types
// ---------------------------------------------------------------------------

// `maxRetriesPerRequest: null` is required by BullMQ for blocking commands.
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export type ProofJobData = {
  type: "CARD_WARS_SHUFFLE";
  gameId: string;
  sessionId: string;
  circuitId: string;
  seed: string;
  shuffled_deck: string[];
  // Checkpoint fields — persisted after proof generation so retries skip it.
  proofHex?: string;
  publicInputs?: string[];
};

// ---------------------------------------------------------------------------
// 2. Queue Setup
// ---------------------------------------------------------------------------

export const PROOF_QUEUE_NAME = "card-wars zk proof";
export const proofQueue = new Queue<ProofJobData>(PROOF_QUEUE_NAME, {
  connection,
});

/**
 * Safely enqueue a proof generation job.
 *
 * The jobId is derived from the session + type so a given session can only ever
 * have one in-flight shuffle proof job (idempotency against double-submits).
 */
export async function enqueueProof(data: ProofJobData) {
  const jobId = `${data.sessionId}-${data.type}`;
  log.info(
    `[PROOF_Q] Enqueuing ${data.type} proof for game-session: ${data.sessionId}`,
  );
  log.info(`[PROOF_Q] job: ${jobId}`);

  await proofQueue.add(data.type, data, {
    jobId, // ensure we don't queue multiple of the same proof
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s...
    removeOnComplete: true,
    removeOnFail: { count: 100 }, // keep last 100 failed for debugging
  });
}

// ---------------------------------------------------------------------------
// 3. Worker Setup
// ---------------------------------------------------------------------------

let proofWorkerInstance: Worker<ProofJobData> | null = null;

/**
 * Lazily start the singleton proof worker. Safe to call multiple times — the
 * second call onwards is a no-op that returns the existing instance.
 */
export function initProofWorker() {
  if (proofWorkerInstance) {
    log.info("[PROOF_WORKER] Proof worker already running, skipping init");
    return proofWorkerInstance;
  }

  log.info(`[PROOF_WORKER] Initializing proof worker (Concurrency: 1)`);

  proofWorkerInstance = new Worker<ProofJobData>(
    PROOF_QUEUE_NAME,
    async (job: Job<ProofJobData>) => {
      const data = job.data;
      log.info(`[PROOF_WORKER] Started processing job: ${job.id}`);

      if (data.type === "CARD_WARS_SHUFFLE") {
        return processShuffleProof(job);
      } else {
        throw new Error(`[Worker] Unknown job type: ${(data as any).type}`);
      }
    },
    {
      connection,
      // Proof generation is CPU-heavy — process one at a time per worker instance.
      concurrency: 1,
    },
  );

  // Observability
  proofWorkerInstance.on("completed", (job) => {
    log.info(`[PROOF_WORKER] Job ${job.id} has completed successfully!`);
  });

  proofWorkerInstance.on("failed", (job, err) => {
    log.error(
      `[PROOF_WORKER] Job ${job?.id} has failed with error:`,
      err.message,
    );
  });

  proofWorkerInstance.on("error", (err) => {
    log.error(`[PROOF_WORKER] Uncaught worker error:`, err);
  });

  return proofWorkerInstance;
}

// ---------------------------------------------------------------------------
// 4. Job Processors
// ---------------------------------------------------------------------------

/** Link every player in the session to the freshly created proof record. */
async function attachProofPlayers(proofId: string, sessionId: string) {
  const sessionPlayers = await prisma.session_players.findMany({
    where: { session_id: sessionId },
    select: { player_address: true },
  });
  if (sessionPlayers.length === 0) return;

  await prisma.proof_players.createMany({
    data: sessionPlayers.map((sp) => ({
      id: crypto.randomUUID(),
      proof_id: proofId,
      player_address: sp.player_address,
    })),
    skipDuplicates: true,
  });
}

export async function processShuffleProof(job: Job<ProofJobData>) {
  const data = job.data;
  const now = new Date();
  const maxAttempts = job.opts.attempts ?? 1;

  try {
    // -----------------------------------------------------------------------
    // Step 1: Generate proof — skipped on retry if checkpoint already set
    // -----------------------------------------------------------------------
    let { proofHex, publicInputs } = data;
    if (!proofHex || !publicInputs) {
      log.info(
        `[PROOF_WORKER] Generating proof for session: ${data.sessionId}`,
      );
      ({ proofHex, publicInputs } = await generateShuffleProof(
        data.seed,
        data.shuffled_deck,
      ));
      // Persist checkpoint: future retries skip proof generation entirely.
      await job.updateData({ ...data, proofHex, publicInputs });
      log.info(
        `[PROOF_WORKER] Proof generated and checkpointed for session: ${data.sessionId}`,
      );
    } else {
      log.info(
        `[PROOF_WORKER] Proof checkpoint found — skipping generation for session: ${data.sessionId}`,
      );
    }

    // -----------------------------------------------------------------------
    // Step 2: Persist proof record — idempotent (session may already have one
    //         from a prior attempt)
    // -----------------------------------------------------------------------
    let proof = await prisma.proofs.findFirst({
      where: { session_id: data.sessionId },
    });
    if (!proof) {
      proof = await prisma.proofs.create({
        data: {
          id: crypto.randomUUID(),
          game_id: data.gameId,
          session_id: data.sessionId,
          circuit_id: data.circuitId,
          // bb.js self-verifies inside generateShuffleProof, so reaching here
          // means local verification passed.
          bb_verification_status: true,
          updated_at: now,
        },
      });
      await attachProofPlayers(proof.id, data.sessionId);
      log.info(
        `[PROOF_WORKER] Proof record created for session: ${data.sessionId}`,
      );
    }

    // -----------------------------------------------------------------------
    // Step 3: Submit to Kurier — the step most likely to fail transiently
    // -----------------------------------------------------------------------
    const { jobId, optimisticVerify } = await submitProof(
      CircuitKind.SHUFFLE,
      proofHex,
      publicInputs,
    );

    await prisma.$transaction(async (tx) => {
      await tx.proofs.update({
        where: { id: proof.id },
        data: { kurier_job_id: jobId },
      });
      await tx.verification_jobs.create({
        data: {
          kurier_job_id: jobId,
          optimistic_verify: optimisticVerify === "success",
          verification_status:
            optimisticVerify === "success" ? "SUBMITTED" : "FAILED",
          updated_at: new Date(),
        },
      });
    });

    log.info(
      `[PROOF_WORKER] Proof submitted to Kurier for session: ${data.sessionId} (jobId: ${jobId})`,
    );

    // Pull the latest status straight away so the DB isn't left at SUBMITTED.
    await syncKurierJobToDatabase(jobId);

    // Success — wipe sensitive fields now that the job is fully done.
    await job.updateData({
      ...job.data,
      seed: "",
      shuffled_deck: [],
      proofHex: undefined,
      publicInputs: undefined,
    });
  } catch (err) {
    log.error(
      `[PROOF_WORKER] Job failed for session ${data.sessionId} (attempt ${job.attemptsMade}/${maxAttempts}):`,
      err,
    );

    // Only wipe the checkpoint on the final attempt — intermediate failures
    // must preserve it so the retry can resume at submission.
    if (job.attemptsMade >= maxAttempts) {
      await job.updateData({
        ...job.data,
        seed: "",
        shuffled_deck: [],
        proofHex: undefined,
        publicInputs: undefined,
      });
    }

    throw err;
  }
}
