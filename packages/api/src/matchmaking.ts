// ---------------------------------------------------------------------------
// Matchmaking
//
// A simple Redis-backed FIFO lobby. Players join a single global queue; the
// second arrival is paired with the oldest waiter. Pairing is atomic via
// RPOP (BullMQ's queue uses a separate connection — this is a plain client).
//
//   queue key:  cardwars:matchmaking:queue   (LPUSH head, RPOP tail => FIFO)
//   match key:  cardwars:match:<address>     (sessionId once paired, TTL'd)
//
// The match key lets the player who was left waiting discover their session
// without a live connection (polled via `pollMatch`); Phase 2 replaces the
// poll with a subscription push.
// ---------------------------------------------------------------------------

import Redis from "ioredis";
import prisma from "@platform/db";
import { env } from "@platform/env/server";
import { createLogger } from "@platform/config/logger";
import { getRoom } from "./game-room";

const log = createLogger("card-wars-matchmaking");

const redis = new Redis(env.REDIS_URL);

const QUEUE_KEY = "cardwars:matchmaking:queue";
const matchKey = (address: string) => `cardwars:match:${address}`;
// Matched sessions are discoverable for an hour — ample for a 7-round game.
const MATCH_TTL_SECONDS = 60 * 60;

/** Ensure a `players` row exists for this address (FK target for sessions). */
export async function ensurePlayer(address: string): Promise<void> {
  // Wallet addresses are always persisted lowercase.
  const id = address.toLowerCase();
  const now = new Date();
  await prisma.players.upsert({
    where: { id },
    update: { updated_at: now },
    create: { id, updated_at: now },
  });
}

/**
 * Try to pair `playerAddress` with a waiting opponent.
 *
 * Returns the opponent's address if one was waiting, otherwise enqueues the
 * caller and returns null. The caller is de-duplicated from the queue first so
 * repeated joins never stack multiple entries for the same player.
 */
export async function tryMatch(playerAddress: string): Promise<string | null> {
  const opponent = await redis.rpop(QUEUE_KEY);

  if (opponent && opponent !== playerAddress) {
    log.info(`[MM] Matched ${playerAddress} with ${opponent}`);
    return opponent;
  }

  // No usable opponent (empty queue, or we popped ourselves). Re-queue the
  // caller, de-duplicated, and report "still waiting".
  if (opponent === playerAddress) {
    log.debug(`[MM] Popped self for ${playerAddress}, re-queueing`);
  }
  await redis.lrem(QUEUE_KEY, 0, playerAddress);
  await redis.lpush(QUEUE_KEY, playerAddress);
  log.info(`[MM] ${playerAddress} waiting in lobby`);
  return null;
}

/** Record the session id for every paired player so they can discover it. */
export async function recordMatch(
  addresses: string[],
  sessionId: string,
): Promise<void> {
  await Promise.all(
    addresses.map((addr) =>
      redis.set(matchKey(addr), sessionId, "EX", MATCH_TTL_SECONDS),
    ),
  );
}

/**
 * Drop the match pointer(s) so a finished or abandoned session is never
 * re-entered. Called when a game finalizes (and defensively on a stale read).
 */
export async function clearMatch(addresses: string[]): Promise<void> {
  await Promise.all(addresses.map((addr) => redis.del(matchKey(addr))));
}

/**
 * Resolve the player's *active* matched session.
 *
 * The match pointer outlives a single game (it has a TTL), so a finished
 * session's id can linger. We return the id only while the game is still in
 * progress and its volatile in-memory room still exists. A server restart can
 * leave the DB row IN_PROGRESS while the concealed hands are gone, so that is
 * stale too; clear it and return null so the caller forms a fresh match.
 */
export async function getActiveMatch(
  playerAddress: string,
): Promise<string | null> {
  const sessionId = await redis.get(matchKey(playerAddress));
  if (!sessionId) return null;

  const session = await prisma.game_sessions.findUnique({
    where: { id: sessionId },
    select: {
      status: true,
      card_wars_sessions: { select: { player_addresses: true } },
    },
  });
  const room = getRoom(sessionId);
  if (session?.status === "IN_PROGRESS" && room) return sessionId;

  const addresses = session?.card_wars_sessions?.player_addresses;
  const staleReason =
    session?.status === "IN_PROGRESS" && !room
      ? "missing-room"
      : (session?.status ?? "missing");

  log.info(
    `[MM] Stale match pointer for ${playerAddress} -> ${sessionId} (${staleReason}); clearing`,
  );
  await clearMatch(addresses?.length ? addresses : [playerAddress]);
  if (session?.status === "IN_PROGRESS" && !room) {
    await prisma.game_sessions.update({
      where: { id: sessionId },
      data: { status: "CANCELLED" },
    });
  }
  return null;
}
