import { createLogger } from "@platform/config/logger";
import { VerificationStatus, type KurierJobStatusResponse } from "./types";
import axios, { isAxiosError } from "axios";
import prisma from "@platform/db";

const log = createLogger("kurier-sync");

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
  const { KURIER_URL, KURIER_API } = process.env;
  if (!KURIER_URL || !KURIER_API) {
    throw new Error("[ERR: Env] Missing environment variables");
  }

  // 1. Query the Kurier relayer for the job's current lifecycle status
  log.debug(`## Querying Kurier job status for jobId: ${jobId}`);
  const job_status_response = await axios.get(
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
const SAVEABLE_PRISMA_STATUSES = new Set([
  "INCLUDED_IN_BLOCK",
  "FINALIZED",
  "AGGREGATION_PENDING",
  "AGGREGATED",
  "FAILED",
]);

const KURIER_TO_PRISMA: Record<VerificationStatus, string> = {
  [VerificationStatus.FAILED]: "FAILED",
  [VerificationStatus.QUEUED]: "QUEUED",
  [VerificationStatus.VALID]: "VALID",
  [VerificationStatus.SUBMITTED]: "SUBMITTED",
  [VerificationStatus.INCLUDED_IN_BLOCK]: "INCLUDED_IN_BLOCK",
  [VerificationStatus.FINALIZED]: "FINALIZED",
  [VerificationStatus.AGGREGATION_PENDING]: "AGGREGATION_PENDING",
  [VerificationStatus.AGGREGATED]: "AGGREGATED",
};

function kurierToPrismaStatus(v: VerificationStatus): string {
  const out = KURIER_TO_PRISMA[v];
  if (!out) throw new Error(`Unknown Kurier verification status: ${String(v)}`);
  return out;
}

/**
 * Pull latest status from Kurier and persist when it reaches a saveable milestone.
 * Safe to call often (e.g. getGame poll); no-ops if Kurier is still behind SUBMITTED.
 */
export async function syncKurierJobToDatabase(kurierJobId: string): Promise<void> {
  try {
    const statusResult = await queryKurierStatus(kurierJobId);
    const prismaStatus = kurierToPrismaStatus(statusResult.verificationStatus);
    if (!SAVEABLE_PRISMA_STATUSES.has(prismaStatus)) return;

    await prisma.verification_jobs.update({
      where: { kurier_job_id: kurierJobId },
      data: {
        verification_status: prismaStatus as any,
        tx_hash: statusResult.txHash,
        aggregation_id: statusResult.aggregationId,
        aggregation_details: (statusResult.aggregationDetails as any) ?? undefined,
      },
    });
  } catch (err) {
    log.error("[KURIER-DB-SYNC] syncing job details to db failed", { kurierJobId, err });
  }
}

export function verificationStatusNeedsKurierPull(
  status: string | null | undefined,
): boolean {
  if (status == null) return true;
  return !["FINALIZED", "AGGREGATED", "FAILED"].includes(status);
}
