import { createLogger } from "@platform/config/logger";
import { VerificationStatus, type KurierJobStatusResponse } from "./types";
import axios from "axios";
import prisma, { type Prisma, type verification_status } from "@platform/db";
import { env } from "@platform/env/server";

const log = createLogger("kurier-sync");

/** Outcome of a single job sync, used by the poller to summarise a cycle. */
export type SyncOutcome = "synced" | "skipped" | "failed";

// Shared axios instance: enforces a timeout so a hung Kurier connection can
// never stall a sync cycle, and reuses the underlying TCP connection across
// the many per-cycle calls.
const kurierHttp = axios.create({
  timeout: env.KURIER_HTTP_TIMEOUT_MS,
});

// ---------------------------------------------------------------------------
// Map from Kurier API status strings → local VerificationStatus enum.
// Kept as a constant so unrecognised values surface immediately at runtime.
// ---------------------------------------------------------------------------
const KURIER_STATUS_MAP: Record<string, VerificationStatus> = {
  Queued: VerificationStatus.QUEUED,
  Valid: VerificationStatus.VALID,
  Submitted: VerificationStatus.SUBMITTED,
  IncludedInBlock: VerificationStatus.INCLUDED_IN_BLOCK,
  Finalized: VerificationStatus.FINALIZED,
  AggregationPending: VerificationStatus.AGGREGATION_PENDING,
  Aggregated: VerificationStatus.AGGREGATED,
  Failed: VerificationStatus.FAILED,
};

/**
 * Query the Kurier relayer for the current status of a verification job.
 *
 * Returns only the fields that map to the `VerificationJob` Prisma model
 * so the API layer can persist them without further transformation.
 *
 * @param jobId — The Kurier job ID returned stored in the database.
 */
export async function queryKurierStatus(
  jobId: string,
): Promise<KurierJobStatusResponse> {
  const { KURIER_URL, KURIER_API } = env;
  if (!KURIER_URL || !KURIER_API) {
    throw new Error("[ERR: Env] Missing KURIER_URL / KURIER_API");
  }

  // 1. Query the Kurier relayer for the job's current lifecycle status
  log.debug(`## Querying Kurier job status for jobId: ${jobId}`);
  const job_status_response = await kurierHttp.get(
    `${KURIER_URL}/job-status/${KURIER_API}/${jobId}`,
  );

  const data = job_status_response.data;
  log.debug(`==> Kurier status response:\n`, JSON.stringify(data, null, 2));

  // 2. Map the Kurier status string to the local VerificationStatus enum
  const mappedStatus = KURIER_STATUS_MAP[data.status];
  if (!mappedStatus) {
    throw new Error(
      `[ERR: Kurier] Unrecognised verification status "${data.status}" for jobId ${jobId}`,
    );
  }

  // 3. Extract only the fields that correspond to the VerificationJob model.
  //    - txHash:             populated once SUBMITTED or later
  //    - aggregationId:      populated at AGGREGATION_PENDING or later
  //    - aggregationDetails: full aggregation metadata blob (nullable)
  const result: KurierJobStatusResponse = {
    verificationStatus: mappedStatus,
    txHash: data.txHash ?? null,
    aggregationId: data.aggregationId ?? null,
    aggregationDetails: data.aggregationDetails ?? null,
  };

  log.info(`## Kurier job ${jobId} status: ${result.verificationStatus}`);

  return result;
}

/** Kurier lifecycle values we persist to `VerificationJob` (matches on-chain publish gate + UI). */
const SAVEABLE_PRISMA_STATUSES = new Set<verification_status>([
  "INCLUDED_IN_BLOCK",
  "FINALIZED",
  "AGGREGATION_PENDING",
  "AGGREGATED",
  "FAILED",
]);

const KURIER_TO_PRISMA: Record<VerificationStatus, verification_status> = {
  [VerificationStatus.FAILED]: "FAILED",
  [VerificationStatus.QUEUED]: "QUEUED",
  [VerificationStatus.VALID]: "VALID",
  [VerificationStatus.SUBMITTED]: "SUBMITTED",
  [VerificationStatus.INCLUDED_IN_BLOCK]: "INCLUDED_IN_BLOCK",
  [VerificationStatus.FINALIZED]: "FINALIZED",
  [VerificationStatus.AGGREGATION_PENDING]: "AGGREGATION_PENDING",
  [VerificationStatus.AGGREGATED]: "AGGREGATED",
};

function kurierToPrismaStatus(v: VerificationStatus): verification_status {
  const out = KURIER_TO_PRISMA[v];
  if (!out) throw new Error(`Unknown Kurier verification status: ${String(v)}`);
  return out;
}

/**
 * Pull latest status from Kurier and persist when it reaches a saveable milestone.
 * Safe to call often (e.g. getGame poll); no-ops if Kurier is still behind SUBMITTED.
 *
 * Errors are caught and logged here (so a single bad job can't abort a batch) but
 * are surfaced to the caller via the returned {@link SyncOutcome} so the poller
 * can report cycle-level success/failure counts:
 *   - "synced"  — a saveable status was written to the DB
 *   - "skipped" — Kurier is still behind a saveable milestone; nothing persisted
 *   - "failed"  — the Kurier query or DB update threw
 */
export async function syncKurierJobToDatabase(
  kurierJobId: string,
): Promise<SyncOutcome> {
  try {
    const statusResult = await queryKurierStatus(kurierJobId);
    const prismaStatus = kurierToPrismaStatus(statusResult.verificationStatus);
    if (!SAVEABLE_PRISMA_STATUSES.has(prismaStatus)) return "skipped";

    await prisma.verification_jobs.update({
      where: { kurier_job_id: kurierJobId },
      data: {
        verification_status: prismaStatus,
        tx_hash: statusResult.txHash,
        aggregation_id: statusResult.aggregationId,
        aggregation_details:
          (statusResult.aggregationDetails as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return "synced";
  } catch (err) {
    log.error("[KURIER-DB-SYNC] syncing job details to db failed", { kurierJobId, err });
    return "failed";
  }
}

/**
 * Terminal Kurier lifecycle states — once a job reaches one of these there is
 * nothing left to poll. NOTE: `FINALIZED` is intentionally NOT terminal; a
 * finalized job still progresses to AGGREGATION_PENDING → AGGREGATED.
 *
 * Single source of truth for "which jobs still need a Kurier pull", shared by
 * both the DB query in the poller and the guard below.
 */
export const TERMINAL_VERIFICATION_STATUSES = ["AGGREGATED", "FAILED"] as const;

export function verificationStatusNeedsKurierPull(
  status: string | null | undefined,
): boolean {
  if (status == null) return true;
  return !TERMINAL_VERIFICATION_STATUSES.includes(status as never);
}
