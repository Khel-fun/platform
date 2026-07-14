// ---------------------------------------------------------------------------
// Kurier ↔ Database sync
//
// Bridges the zkVerify Kurier relayer's verification lifecycle with our local
// `verification_jobs` table. Kurier advances a proof through several states
// (QUEUED → VALID → SUBMITTED → INCLUDED_IN_BLOCK → … → AGGREGATED); we only
// persist the milestones that gate on-chain publishing and the UI.
// ---------------------------------------------------------------------------

import prisma from "@platform/db";
import {
  queryKurierStatus,
  VerificationStatus as KurierVerificationStatus,
} from "@platform/proving-setup";
import { createLogger } from "@platform/config/logger";

const log = createLogger("kurier-db-syncing");

// Kurier lifecycle values we persist to `verification_jobs`.
// Anything earlier than INCLUDED_IN_BLOCK is still in flight and not worth a
// write — this matches the on-chain publish gate and what the UI surfaces.
const SAVEABLE_PRISMA_STATUSES = new Set<string>([
  "INCLUDED_IN_BLOCK",
  "FINALIZED",
  "AGGREGATION_PENDING",
  "AGGREGATED",
  "FAILED",
]);

// Translate the proving-setup enum into the Prisma `verification_status` enum
// string. The two are kept deliberately separate so a relayer-side rename
// can't silently corrupt persisted data.
const KURIER_TO_PRISMA: Record<KurierVerificationStatus, string> = {
  [KurierVerificationStatus.FAILED]: "FAILED",
  [KurierVerificationStatus.QUEUED]: "QUEUED",
  [KurierVerificationStatus.VALID]: "VALID",
  [KurierVerificationStatus.SUBMITTED]: "SUBMITTED",
  [KurierVerificationStatus.INCLUDED_IN_BLOCK]: "INCLUDED_IN_BLOCK",
  [KurierVerificationStatus.FINALIZED]: "FINALIZED",
  [KurierVerificationStatus.AGGREGATION_PENDING]: "AGGREGATION_PENDING",
  [KurierVerificationStatus.AGGREGATED]: "AGGREGATED",
};

/** Map a Kurier verification status to its Prisma enum string, or throw on an unknown value. */
function kurierToPrismaStatus(v: KurierVerificationStatus): string {
  const out = KURIER_TO_PRISMA[v];
  if (!out) {
    throw new Error(`Unknown Kurier verification status: ${String(v)}`);
  }
  return out;
}

/**
 * Pull the latest status from Kurier and persist it once it reaches a saveable
 * milestone.
 *
 * Safe to call often (e.g. on a `getGame` poll): it no-ops while Kurier is
 * still behind INCLUDED_IN_BLOCK, and it swallows errors so a transient relayer
 * hiccup never breaks the calling request.
 *
 * @param kurierJobId - The Kurier job ID stored on the `verification_jobs` row.
 */
export async function syncKurierJobToDatabase(
  kurierJobId: string,
): Promise<void> {
  try {
    log.debug("[KURIER-DB-SYNC] polling Kurier for job status", { kurierJobId });
    const statusResult = await queryKurierStatus(kurierJobId);
    const prismaStatus = kurierToPrismaStatus(statusResult.verificationStatus);

    // Still in flight — nothing durable to record yet.
    if (!SAVEABLE_PRISMA_STATUSES.has(prismaStatus)) {
      log.debug("[KURIER-DB-SYNC] status not yet saveable, skipping write", {
        kurierJobId,
        prismaStatus,
      });
      return;
    }

    await prisma.verification_jobs.update({
      where: { kurier_job_id: kurierJobId },
      data: {
        verification_status: prismaStatus as any,
        tx_hash: statusResult.txHash,
        aggregation_id: statusResult.aggregationId,
        aggregation_details:
          (statusResult.aggregationDetails as any) ?? undefined,
      },
    });

    log.info("[KURIER-DB-SYNC] persisted verification status", {
      kurierJobId,
      prismaStatus,
    });
  } catch (err) {
    log.error("[KURIER-DB-SYNC] syncing job details to db failed", {
      kurierJobId,
      err,
    });
  }
}

/**
 * Decide whether a stored verification status still warrants polling Kurier.
 *
 * Terminal states (FINALIZED, AGGREGATED, FAILED) never change again, so we
 * stop pulling once we reach one. A null/undefined status (job not yet synced)
 * always needs a pull.
 */
export function verificationStatusNeedsKurierPull(
  status: string | null | undefined,
): boolean {
  if (status == null) return true;
  return !["FINALIZED", "AGGREGATED", "FAILED"].includes(status);
}
