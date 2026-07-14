export enum CircuitKind {
  SHUFFLE = "shuffle",
};

export enum VerificationStatus {
  FAILED = "failed",
  QUEUED = "queued",
  VALID = "valid",
  SUBMITTED = "submitted",
  INCLUDED_IN_BLOCK = "included_in_block",
  FINALIZED = "finalized",
  AGGREGATION_PENDING = "aggregation_pending",
  AGGREGATED = "aggregated",
};

export type AggregationDetails = {
  receipt: string;
  receiptBlockHash: string;
  root: string;
  leaf: string;
  leafIndex: number;
  numberOfLeaves: number;
  merkleProof: string[];
};

export interface KurierJobStatusResponse {
  verificationStatus: VerificationStatus;
  txHash: string | null;
  aggregationId: number | null;
  aggregationDetails: AggregationDetails | null;
}
