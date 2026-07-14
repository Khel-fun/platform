// The signed `Result` payload and its EIP-712 type definition.
//
// ⚠️ Field order is load-bearing: this list, the Solidity RESULT_TYPEHASH, and
// the contract's abi.encode must all agree. A mismatch silently recovers the
// wrong signer and every signature is rejected.

import { type Address, type Hex, getAddress, keccak256, pad, toBytes } from "viem";

export type { Address, Hex } from "viem";

/** EIP-712 types for the `Result` struct (field order mirrors the contract). */
export const RESULT_TYPES = {
  Result: [
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
} as const;

/** The full backend-attested result of one session (viem-encodable). */
export type GameResult = {
  sessionId: Hex;
  seedTxHash: Hex;
  playerA: Address;
  playerB: Address;
  xpA: bigint;
  xpB: bigint;
  result: number; // 0 = tie, 1 = A wins, 2 = B wins
  deckCommitment: Hex;
  handCommitmentA: Hex;
  handCommitmentB: Hex;
  deadline: bigint;
};

/** Result enum mirroring the contract's `uint8 result`. */
export const RESULT_TIE = 0;
export const RESULT_A_WINS = 1;
export const RESULT_B_WINS = 2;

/**
 * Coerce a commitment/seed value into a `bytes32`.
 *
 * Accepts a 0x hex string (left-padded to 32 bytes) or a decimal numeric string
 * (Noir `Field`, which fits in 32 bytes). Anything else is hashed so the result
 * is always a valid, deterministic 32-byte value.
 */
export function asBytes32(value: string): Hex {
  const v = value.trim();

  if (/^0x[0-9a-fA-F]{1,64}$/.test(v)) {
    return pad(v as Hex, { size: 32 });
  }

  if (/^[0-9]+$/.test(v)) {
    const big = BigInt(v);
    if (big < 1n << 256n) {
      return pad(`0x${big.toString(16)}` as Hex, { size: 32 });
    }
  }

  return keccak256(toBytes(v));
}

/** Derive a `bytes32` session id from a backend UUID (collision-resistant). */
export function hashSessionId(sessionId: string): Hex {
  return keccak256(toBytes(sessionId));
}

/** Checksum a (lowercase) address into the EIP-55 form viem expects. */
export function toChecksumAddress(address: string): Address {
  return getAddress(address);
}
