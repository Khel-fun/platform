// Client-side GameRegistry bits for the permissionless player fallback.
//
// The backend signs the payload; the player only relays it. We keep a minimal
// ABI (just the two methods a player touches) plus a converter from the
// JSON-safe payload the API returns (bigints as strings) into viem args.

import type { Address, Hex } from "viem";

export const gameRegistryAbi = [
  {
    type: "function",
    name: "finalizeSession",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "r",
        type: "tuple",
        components: [
          { name: "sessionId", type: "bytes32" },
          { name: "seedTxHash", type: "bytes32" },
          { name: "playerA", type: "address" },
          { name: "playerB", type: "address" },
          { name: "xpA", type: "uint128" },
          { name: "xpB", type: "uint128" },
          { name: "result", type: "uint8" },
          { name: "deckCommitment", type: "bytes32" },
          { name: "handCommitmentA", type: "bytes32" },
          { name: "handCommitmentB", type: "bytes32" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "sessionStatus",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  { type: "error", name: "SessionAlreadyFinalized", inputs: [] },
] as const;

export type SerializedResult = {
  sessionId: Hex;
  seedTxHash: Hex;
  playerA: Hex;
  playerB: Hex;
  xpA: string;
  xpB: string;
  result: number;
  deckCommitment: Hex;
  handCommitmentA: Hex;
  handCommitmentB: Hex;
  deadline: string;
};

/** Rehydrate the JSON-safe payload into the viem tuple (bigints restored). */
export function toContractResult(r: SerializedResult) {
  return {
    sessionId: r.sessionId,
    seedTxHash: r.seedTxHash,
    playerA: r.playerA as Address,
    playerB: r.playerB as Address,
    xpA: BigInt(r.xpA),
    xpB: BigInt(r.xpB),
    result: r.result,
    deckCommitment: r.deckCommitment,
    handCommitmentA: r.handCommitmentA,
    handCommitmentB: r.handCommitmentB,
    deadline: BigInt(r.deadline),
  } as const;
}
