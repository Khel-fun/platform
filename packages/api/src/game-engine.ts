// ---------------------------------------------------------------------------
// Card Wars game engine
//
// The authoritative round loop over an in-memory GameRoom:
//   - each round opens a 10s window (ROUND_MS); both players commit one card
//   - the round resolves the instant both have played, or when the timer fires
//   - scoring follows game-idea.txt: higher rank wins 20 XP, ties split 10/10,
//     a no-show forfeits its 20 to the opponent, a double no-show scores 0/0
//   - after a short reveal beat, the next round opens; after TOTAL_ROUNDS the
//     game finalizes and writes the durable outcome
//
// All live updates are pushed to subscribers via the room's event bus. DB
// writes are best-effort checkpoints — a transient DB error must not crash the
// in-memory match in progress.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import prisma from "@platform/db";
import { createLogger } from "@platform/config/logger";
import { numberToCard } from "./utils";
import {
  deleteRoom,
  emitRoomEvent,
  type GameRoom,
  ROUND_MS,
  slotIndex,
  TOTAL_ROUNDS,
} from "./game-room";
import { clearMatch } from "./matchmaking";
import { finalizeSessionOnChain } from "./onchain-finalize";

const log = createLogger("card-wars-engine");

const ROUND_WIN_XP = 20;
const ROUND_SPLIT_XP = 10;
const ROUND_REVEAL_HOLD_MS = 2_000;

// Keep a finished room around briefly so the game-over screen can still read it,
// then reap it so memory doesn't grow and a rematch can't re-enter stale state.
const ROOM_CLEANUP_MS = 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Score a single round from each side's played card number (`null` = no show).
 * Pure and total — the unit-testable heart of the game rules.
 *
 * @returns `[player1Xp, player2Xp]` awarded for the round.
 */
export function scoreRound(
  cardA: number | null,
  cardB: number | null,
): [number, number] {
  if (cardA === null && cardB === null) return [0, 0];
  if (cardA === null) return [0, ROUND_WIN_XP];
  if (cardB === null) return [ROUND_WIN_XP, 0];

  const rankA = numberToCard(cardA).rank;
  const rankB = numberToCard(cardB).rank;
  if (rankA > rankB) return [ROUND_WIN_XP, 0];
  if (rankB > rankA) return [0, ROUND_WIN_XP];
  return [ROUND_SPLIT_XP, ROUND_SPLIT_XP];
}

/** Begin the match: kick off round 1. Idempotent. */
export function startGame(room: GameRoom): void {
  if (room.started || room.status === "FINISHED") return;
  room.started = true;
  log.info(`[ENGINE] Game started for session ${room.sessionId}`);
  startRound(room);
}

/** Open a fresh round window and arm the timeout. */
function startRound(room: GameRoom): void {
  room.pending = [null, null];
  room.deadline = Date.now() + ROUND_MS;
  emitRoomEvent(room, {
    type: "round:start",
    round: room.currentRound,
    deadline: room.deadline,
  });
  room.timer = setTimeout(() => {
    void resolveRound(room);
  }, ROUND_MS);
}

/**
 * Commit `handIndex` for the calling player in the current round. Resolves the
 * round immediately once both sides have played.
 */
export function playCard(
  room: GameRoom,
  address: string,
  handIndex: number,
): void {
  if (!room.started || room.status === "FINISHED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Game is not accepting plays",
    });
  }
  const slot = slotIndex(room, address);
  if (slot === undefined) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a participant in this session",
    });
  }
  const player = room.players[slot]!;
  if (handIndex < 0 || handIndex >= player.hand.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid hand index" });
  }
  if (player.played[handIndex]) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Card already played",
    });
  }
  if (room.pending[slot]) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Already played this round",
    });
  }

  room.pending[slot] = { handIndex, cardNumber: player.hand[handIndex]! };
  emitRoomEvent(room, { type: "card:played", slot, round: room.currentRound });

  if (room.pending[0] && room.pending[1]) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    void resolveRound(room);
  }
}

/** Reveal, score, persist, then advance to the next round or finalize. */
async function resolveRound(room: GameRoom): Promise<void> {
  // Guard against a timer firing after both played (or vice versa).
  if (room.results.some((r) => r.round === room.currentRound)) return;
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  room.deadline = null;

  const play0 = room.pending[0];
  const play1 = room.pending[1];
  const card0 = play0?.cardNumber ?? null;
  const card1 = play1?.cardNumber ?? null;

  const [xp0, xp1] = scoreRound(card0, card1);
  if (play0) room.players[0].played[play0.handIndex] = true;
  if (play1) room.players[1].played[play1.handIndex] = true;
  room.players[0].xp += xp0;
  room.players[1].xp += xp1;

  const totals: [number, number] = [room.players[0].xp, room.players[1].xp];
  room.results.push({
    round: room.currentRound,
    cards: [card0, card1],
    roundXp: [xp0, xp1],
    totals,
  });
  emitRoomEvent(room, {
    type: "round:reveal",
    round: room.currentRound,
    cards: [card0, card1],
    roundXp: [xp0, xp1],
    totals,
  });

  await persistScore(room, totals);
  await sleep(ROUND_REVEAL_HOLD_MS);

  if (room.currentRound >= TOTAL_ROUNDS) {
    await finalizeGame(room, totals);
  } else {
    room.currentRound += 1;
    startRound(room);
  }
}

/** Checkpoint the running totals onto the card-wars session row. */
async function persistScore(
  room: GameRoom,
  totals: [number, number],
): Promise<void> {
  try {
    await prisma.card_wars_sessions.update({
      where: { session_id: room.sessionId },
      data: { score: totals },
    });
  } catch (err) {
    log.error(`[ENGINE] Failed to persist score for ${room.sessionId}:`, err);
  }
}

/** Write the durable game outcome and update player aggregates + leaderboard. */
async function finalizeGame(
  room: GameRoom,
  totals: [number, number],
): Promise<void> {
  room.status = "FINISHED";
  room.deadline = null;

  const [p1, p2] = room.players;
  const isDraw = totals[0] === totals[1];
  const winner = isDraw ? null : totals[0] > totals[1] ? p1.address : p2.address;

  // Emit from the in-memory source of truth first so clients see the result
  // even if a DB write later hiccups.
  emitRoomEvent(room, {
    type: "game:over",
    round: room.currentRound,
    totals,
    winner,
    isDraw,
  });
  log.info(
    `[ENGINE] Game over for ${room.sessionId}: ${totals[0]}-${totals[1]} winner=${winner ?? "draw"}`,
  );

  try {
    await prisma.$transaction([
      prisma.session_players.updateMany({
        where: { session_id: room.sessionId, player_address: p1.address },
        data: { xp: p1.xp, is_winner: winner === p1.address },
      }),
      prisma.session_players.updateMany({
        where: { session_id: room.sessionId, player_address: p2.address },
        data: { xp: p2.xp, is_winner: winner === p2.address },
      }),
      prisma.card_wars_sessions.update({
        where: { session_id: room.sessionId },
        data: { score: totals, has_winner: !isDraw, winner },
      }),
      prisma.game_sessions.update({
        where: { id: room.sessionId },
        data: { status: "FINISHED" },
      }),
      prisma.players.update({
        where: { id: p1.address },
        data: {
          total_xp: { increment: p1.xp },
          wins: { increment: winner === p1.address ? 1 : 0 },
        },
      }),
      prisma.players.update({
        where: { id: p2.address },
        data: {
          total_xp: { increment: p2.xp },
          wins: { increment: winner === p2.address ? 1 : 0 },
        },
      }),
    ]);

    await Promise.all([
      updateLeaderboard(room.gameId, room.sessionId, p1.address, p1.xp),
      updateLeaderboard(room.gameId, room.sessionId, p2.address, p2.xp),
    ]);
  } catch (err) {
    log.error(`[ENGINE] Failed to finalize ${room.sessionId}:`, err);
  }

  // Settle the outcome on-chain. Fire-and-forget: it's idempotent, retries
  // internally, and the player fallback covers a backend failure — so it must
  // never block or crash the game loop.
  void finalizeSessionOnChain(room.sessionId);

  // Release the matchmaking pointers so a rematch of the same pair forms a new
  // session instead of re-entering this finished one, and reap the room after a
  // short grace (the game-over screen may still read it).
  void clearMatch([p1.address, p2.address]);
  setTimeout(() => deleteRoom(room.sessionId), ROOM_CLEANUP_MS);
}

/** Keep each player's best per-game XP in the leaderboard. */
async function updateLeaderboard(
  gameId: string,
  sessionId: string,
  playerAddress: string,
  xp: number,
): Promise<void> {
  const now = new Date();
  const existing = await prisma.player_game_leaderboard.findUnique({
    where: { player_address_game_id: { player_address: playerAddress, game_id: gameId } },
  });
  if (!existing) {
    await prisma.player_game_leaderboard.create({
      data: {
        id: randomUUID(),
        player_address: playerAddress,
        game_id: gameId,
        best_session_xp: xp,
        best_session_id: sessionId,
        updated_at: now,
      },
    });
  } else if (xp > existing.best_session_xp) {
    await prisma.player_game_leaderboard.update({
      where: { id: existing.id },
      data: { best_session_xp: xp, best_session_id: sessionId, updated_at: now },
    });
  }
}

/**
 * Poll the proof pipeline once and emit a fairness event when Kurier has
 * optimistically verified the shuffle. Runs at most once per room.
 */
export function watchFairness(room: GameRoom): void {
  if (room.fairnessWatched) return;
  room.fairnessWatched = true;

  void (async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const proof = await prisma.proofs.findFirst({
          where: { session_id: room.sessionId },
          include: { verification_jobs: true },
        });
        const job = proof?.verification_jobs;
        if (job?.optimistic_verify) {
          emitRoomEvent(room, {
            type: "fairness",
            verified: true,
            status: job.verification_status ?? null,
          });
          return;
        }
      } catch (err) {
        log.error(`[ENGINE] Fairness poll failed for ${room.sessionId}:`, err);
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  })();
}
