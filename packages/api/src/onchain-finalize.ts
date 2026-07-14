// ---------------------------------------------------------------------------
// On-chain session finalization
//
// Turns a finished session into a GameRegistry `Result`, signs it with the
// backend signer key, and submits `finalizeSession`. The payload is built
// deterministically from persisted state so the *exact same* signed bytes can
// be re-produced for the permissionless player fallback (EIP-712 signing is
// deterministic, so re-signing yields an identical signature).
//
//   normal path : backend submits the tx itself (finalizeSessionOnChain)
//   fallback    : either player submits the same payload (getFinalizationPayload)
//
// Idempotency is the contract's: it reverts SessionAlreadyFinalized on a
// double-submit, and we check sessionStatus before paying for a tx. XP deltas
// are commutative on-chain, so submission order never matters.
// ---------------------------------------------------------------------------

import prisma from "@platform/db";
import { createLogger } from "@platform/config/logger";
import {
  type GameResult,
  type Hex,
  asBytes32,
  getRegistryConfig,
  getSessionStatus,
  hashSessionId,
  isAlreadyFinalizedError,
  isOnchainConfigured,
  RESULT_A_WINS,
  RESULT_B_WINS,
  RESULT_TIE,
  signResult,
  submitFinalize,
  toChecksumAddress,
} from "@platform/onchain-setup";

const log = createLogger("card-wars-onchain");

// Generous window: a 7-round game finalizes minutes after creation, but the
// fallback must stay submittable for a while if the backend is down.
const DEADLINE_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const MAX_SUBMIT_ATTEMPTS = 3;
const RETRY_BASE_MS = 4000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializable form of a Result (bigints as decimal strings) for the client. */
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

/**
 * Build the deterministic `Result` for a finished session from persisted state.
 *
 * Player A is `card_wars_sessions.player_addresses[0]` (player 1), so hand
 * commitments line up positionally; XP is read per-address from
 * `session_players`, so the XP→player mapping is always correct.
 */
export async function buildResultForSession(
  sessionId: string,
): Promise<GameResult> {
  const cw = await prisma.card_wars_sessions.findUnique({
    where: { session_id: sessionId },
  });
  if (!cw) {
    throw new Error(`[ONCHAIN] No card_wars_session for ${sessionId}`);
  }

  const players = await prisma.session_players.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: "asc" },
  });
  if (players.length !== 2) {
    throw new Error(
      `[ONCHAIN] Session ${sessionId} has ${players.length} players, expected 2`,
    );
  }

  // Canonical A/B order: persisted positional addresses when present, else fall
  // back to player join order. Index i also indexes player_hands_roots[i].
  const ordered =
    cw.player_addresses.length === 2
      ? cw.player_addresses
      : players.map((p) => p.player_address);

  const addrA = ordered[0]!;
  const addrB = ordered[1]!;
  const xpByAddress = new Map(players.map((p) => [p.player_address, p.xp]));
  const xpA = BigInt(xpByAddress.get(addrA) ?? 0);
  const xpB = BigInt(xpByAddress.get(addrB) ?? 0);

  const result =
    xpA > xpB ? RESULT_A_WINS : xpB > xpA ? RESULT_B_WINS : RESULT_TIE;

  const deadline =
    BigInt(Math.floor(cw.created_at.getTime() / 1000)) +
    BigInt(DEADLINE_WINDOW_SECONDS);

  return {
    // UUID → bytes32; collision-resistant and stable across re-derivations.
    sessionId: hashSessionId(sessionId),
    seedTxHash: asBytes32(cw.seed),
    playerA: toChecksumAddress(addrA),
    playerB: toChecksumAddress(addrB),
    xpA,
    xpB,
    result,
    deckCommitment: asBytes32(cw.deck_merkle_root),
    handCommitmentA: asBytes32(cw.player_hands_roots[0] ?? "0"),
    handCommitmentB: asBytes32(cw.player_hands_roots[1] ?? "0"),
    deadline,
  };
}

/**
 * Backend normal path: sign and submit the finalization tx, with retries.
 * Best-effort and idempotent — never throws into the caller (the game loop).
 */
export async function finalizeSessionOnChain(sessionId: string): Promise<void> {
  if (!isOnchainConfigured()) {
    log.info(`[ONCHAIN] Skipping ${sessionId} — no registry configured`);
    return;
  }

  let result: GameResult;
  try {
    result = await buildResultForSession(sessionId);
  } catch (err) {
    log.error(`[ONCHAIN] Failed to build result for ${sessionId}:`, err);
    return;
  }

  try {
    if ((await getSessionStatus(result.sessionId)) === 1) {
      log.info(`[ONCHAIN] ${sessionId} already finalized on-chain`);
      return;
    }
  } catch (err) {
    // A read failure shouldn't stop us from trying to submit.
    log.warn(`[ONCHAIN] sessionStatus read failed for ${sessionId}:`, err);
  }

  let signature: Hex;
  try {
    signature = await signResult(result);
  } catch (err) {
    log.error(`[ONCHAIN] Failed to sign result for ${sessionId}:`, err);
    return;
  }

  for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
    try {
      const tx = await submitFinalize(result, signature);
      log.info(`[ONCHAIN] Session ${sessionId} finalized on-chain (tx ${tx})`);
      return;
    } catch (err) {
      if (isAlreadyFinalizedError(err)) {
        log.info(`[ONCHAIN] ${sessionId} finalized by another submitter`);
        return;
      }
      log.error(
        `[ONCHAIN] Submit attempt ${attempt}/${MAX_SUBMIT_ATTEMPTS} failed for ${sessionId}:`,
        err,
      );
      if (attempt < MAX_SUBMIT_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
    }
  }

  log.error(
    `[ONCHAIN] Gave up submitting ${sessionId} — player fallback remains available`,
  );
}

/**
 * Fallback path: produce the signed payload (+ current on-chain status) so a
 * player can submit `finalizeSession` from their own wallet.
 */
export async function getFinalizationPayload(sessionId: string): Promise<
  | { configured: false }
  | {
      configured: true;
      contractAddress: Hex;
      chainId: number;
      alreadyFinalized: boolean;
      signature: Hex;
      result: SerializedResult;
    }
> {
  if (!isOnchainConfigured()) return { configured: false };

  const result = await buildResultForSession(sessionId);
  const signature = await signResult(result);
  const { address, chainId } = getRegistryConfig();

  let alreadyFinalized = false;
  try {
    alreadyFinalized = (await getSessionStatus(result.sessionId)) === 1;
  } catch (err) {
    log.warn(`[ONCHAIN] sessionStatus read failed for ${sessionId}:`, err);
  }

  return {
    configured: true,
    contractAddress: address,
    chainId,
    alreadyFinalized,
    signature,
    result: {
      sessionId: result.sessionId,
      seedTxHash: result.seedTxHash,
      playerA: result.playerA,
      playerB: result.playerB,
      xpA: result.xpA.toString(),
      xpB: result.xpB.toString(),
      result: result.result,
      deckCommitment: result.deckCommitment,
      handCommitmentA: result.handCommitmentA,
      handCommitmentB: result.handCommitmentB,
      deadline: result.deadline.toString(),
    },
  };
}
