import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { env } from "@platform/env/server";
import prisma from "@platform/db";
import {
  syncKurierJobToDatabase,
  TERMINAL_VERIFICATION_STATUSES,
  type SyncOutcome,
} from "./kurier_sync";
import { createLogger } from "@platform/config/logger";

/**
 * Run `task` over every item with at most `limit` in flight at once, returning
 * each task's result in input order. Never rejects — each task is isolated so
 * one failure can't abort the pool (the task itself must not throw).
 */
async function runBounded<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await task(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

const log = createLogger("kurier-polling-setup");

// BullMQ requires `maxRetriesPerRequest: null` on any connection used for
// blocking commands. The Queue (producer) and Worker (consumer) get separate
// connections: the Worker holds a connection open on blocking BRPOPLPUSH calls,
// so sharing one instance would starve the Queue's own commands.
const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const workerConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

let workerInstance: Worker | null = null;

export const KURIER_SYNC_QUEUE_NAME = "kurier-status-sync";

// 1. Setup the queue for repeatable jobs
export const kurierSyncQueue = new Queue(KURIER_SYNC_QUEUE_NAME, {
  connection: queueConnection,
});

// 2. Schedule the recurring job every 2 minutes
export async function scheduleKurierSync() {
  log.info("[KURIER-POLLER] cleaning up old repeat jobs");

  // Remove ALL existing repeat jobs before registering a new one
  const existingJobs = await kurierSyncQueue.getJobSchedulers();
  for (const job of existingJobs) {
    await kurierSyncQueue.removeJobScheduler(job.key);
    log.info(`[KURIER-POLLER] removed old job: ${job.key}`);

  }

  log.info(`[KURIER-POLLER] scheduling fresh Kurier sync job`);
  await kurierSyncQueue.add(
    "sync-job",
    {},
    {
      repeat: { every: env.KURIER_SYNC_INTERVAL_MS },
      jobId: "kurier-sync-repeater",
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    },
  );
}

// 3. Worker logic
export function initKurierSyncWorker() {
  if (workerInstance) {
    log.info("[KURIER-WORKER] worker already running, skipping init");
    return workerInstance;
  }
  log.info(`[KURIER-WORKER] initializing Kurier sync worker`);

  workerInstance = new Worker(
    KURIER_SYNC_QUEUE_NAME,
    async (job) => {
      log.info(`[KURIER-WORKER] Job ${job.id} started.`);

      // Only pull jobs that aren't already in a terminal state. `null` status
      // (never synced) is included. Select just the id — the sync loop needs
      // nothing else, so we avoid fetching the aggregation_details JSON blob.
      const jobsToSync = await prisma.verification_jobs.findMany({
        where: {
          OR: [
            { verification_status: null },
            {
              verification_status: {
                notIn: [...TERMINAL_VERIFICATION_STATUSES],
              },
            },
          ],
        },
        select: { kurier_job_id: true },
      });

      log.info(
        `[KURIER-WORKER] Found ${jobsToSync.length} jobs to sync (concurrency=${env.KURIER_SYNC_CONCURRENCY}).`,
      );

      // Sync with bounded concurrency instead of one-at-a-time, so cycle time
      // scales with the pool size rather than the total job count.
      // syncKurierJobToDatabase isolates its own errors and reports the outcome.
      const outcomes = await runBounded(
        jobsToSync,
        env.KURIER_SYNC_CONCURRENCY,
        (verificationJob) => syncKurierJobToDatabase(verificationJob.kurier_job_id),
      );

      // Aggregate a cycle-level summary so a Kurier outage is visible as a
      // failure count rather than being buried in per-job log lines.
      const tally = { synced: 0, skipped: 0, failed: 0 } satisfies Record<
        SyncOutcome,
        number
      >;
      for (const outcome of outcomes) tally[outcome]++;

      const summary = `synced=${tally.synced} skipped=${tally.skipped} failed=${tally.failed}`;
      if (tally.failed > 0) {
        log.error(`[KURIER-WORKER] Sync cycle completed with failures: ${summary}`);
      } else {
        log.info(`[KURIER-WORKER] Sync cycle completed: ${summary}`);
      }
    },
    {
      connection: workerConnection,
      concurrency: 1,
      removeOnComplete: { count: 10 }, // keep only last 10 completed jobs
      removeOnFail: { count: 50 }, // keep last 50 failed for debugging
    },
  );

  workerInstance.on("error", (err) => {
    log.error(`[KURIER-WORKER] Uncaught error:`, err);
  });

  return workerInstance;
}

export async function initKurierPoller() {
  await scheduleKurierSync();
  const worker = initKurierSyncWorker(); // returns the singleton
  return worker;
}

/**
 * Gracefully drain the poller: stop the worker, close the queue, and quit both
 * Redis connections. Safe to call on SIGTERM/SIGINT even if init never ran.
 */
export async function shutdownKurierPoller() {
  log.info("[KURIER-POLLER] shutting down poller");
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
  await kurierSyncQueue.close();
  await Promise.all([queueConnection.quit(), workerConnection.quit()]);
  log.info("[KURIER-POLLER] shutdown complete");
}
