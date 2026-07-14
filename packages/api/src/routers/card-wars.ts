// ---------------------------------------------------------------------------
// Card Wars router
//
// Phase 1 surface: matchmaking, private hand delivery, and fairness status.
//   - joinQueue / pollMatch : enter the lobby and discover the matched session
//   - getMyHand             : the caller's own 7 cards (never the opponent's)
//   - fairnessStatus        : drives the "Fairness Verified" banner
//
// Live round play (playCard, reveal, timers) arrives in Phase 2 over a
// WebSocket subscription transport; the poll-style queries here are the
// no-socket stand-ins that keep the flow verifiable today.
// ---------------------------------------------------------------------------

import { on } from "node:events";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import prisma from "@platform/db";
import { playerProcedure, publicProcedure, router } from "../index";
import {
  ensurePlayer,
  getActiveMatch,
  recordMatch,
  tryMatch,
} from "../matchmaking";
import { createCardWarsSession } from "../card-wars-session";
import {
  type GameEvent,
  getRoom,
  roomSnapshot,
  slotIndex,
} from "../game-room";
import {
  playCard as enginePlayCard,
  startGame,
  watchFairness,
} from "../game-engine";
import { getFinalizationPayload } from "../onchain-finalize";
import { numberToCard } from "../utils";

export const cardWarsRouter = router({
  /** Enter the lobby. Pairs with a waiter, or queues and reports "waiting". */
  joinQueue: playerProcedure.mutation(async ({ ctx }) => {
    const address = ctx.playerAddress;
    await ensurePlayer(address);

    // Reconnect only to a still-active match; a finished session's stale pointer
    // is cleared by getActiveMatch so we fall through to fresh matchmaking.
    const existing = await getActiveMatch(address);
    if (existing) {
      return { status: "matched" as const, sessionId: existing };
    }

    const opponent = await tryMatch(address);
    if (!opponent) {
      return { status: "waiting" as const };
    }

    const sessionId = await createCardWarsSession(opponent, address);
    await recordMatch([opponent, address], sessionId);
    return { status: "matched" as const, sessionId };
  }),

  /** Poll for a match while waiting in the lobby (Phase 2: subscription push). */
  pollMatch: playerProcedure.query(async ({ ctx }) => {
    const sessionId = await getActiveMatch(ctx.playerAddress);
    return sessionId
      ? { status: "matched" as const, sessionId }
      : { status: "waiting" as const };
  }),

  /** The caller's own hand for a session — never reveals the opponent's cards. */
  getMyHand: playerProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) => {
      const room = getRoom(input.sessionId);
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      const mySlot = slotIndex(room, ctx.playerAddress);
      const slot = mySlot === undefined ? undefined : room.players[mySlot];
      if (slot === undefined || mySlot === undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant in this session",
        });
      }

      return {
        /** Which player slot the caller is (0 or 1) — maps totals/reveals. */
        slot: mySlot,
        round: room.currentRound,
        status: room.status,
        hand: slot.hand.map((number, index) => ({
          /** Hand slot index (0–6), used to play a specific card. */
          index,
          /** Card number 0–51; also the face asset index (card_faces/NN.png). */
          number,
          played: slot.played[index],
          ...numberToCard(number),
        })),
      };
    }),

  /** Commit a card from the caller's hand for the current round. */
  playCard: playerProcedure
    .input(
      z.object({
        sessionId: z.string(),
        handIndex: z.number().int().min(0).max(6),
      }),
    )
    .mutation(({ ctx, input }) => {
      const room = getRoom(input.sessionId);
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      enginePlayCard(room, ctx.playerAddress, input.handIndex);
      return { ok: true as const };
    }),

  /**
   * Live room channel: round starts, reveals, scores, game-over, and fairness.
   * Begins the match once both participants are connected. Each subscriber
   * first receives a `state` snapshot + current fairness so reconnects catch up.
   */
  subscribeRoom: playerProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(async function* ({ ctx, input, signal }) {
      const room = getRoom(input.sessionId);
      if (!room) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      if (slotIndex(room, ctx.playerAddress) === undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant in this session",
        });
      }

      // Attach the listener queue before emitting/starting so no event is lost.
      const events = on(room.events, "event", { signal });

      room.subscribers += 1;
      watchFairness(room);
      try {
        // Catch a (re)connecting player up to the current state + fairness.
        yield roomSnapshot(room);
        const proof = await prisma.proofs.findFirst({
          where: { session_id: input.sessionId },
          include: { verification_jobs: true },
        });
        yield {
          type: "fairness" as const,
          verified: proof?.verification_jobs?.optimistic_verify ?? false,
          status: proof?.verification_jobs?.verification_status ?? null,
        } satisfies GameEvent;

        // Begin play once both participants are connected.
        if (room.subscribers >= 2) startGame(room);

        for await (const [event] of events) {
          const ev = event as GameEvent;
          yield ev;
          if (ev.type === "game:over") break;
        }
      } finally {
        room.subscribers -= 1;
      }
    }),

  /** Fairness/proof status for a session — true once Kurier optimistically verifies. */
  fairnessStatus: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const proof = await prisma.proofs.findFirst({
        where: { session_id: input.sessionId },
        include: { verification_jobs: true },
      });
      const job = proof?.verification_jobs;
      return {
        verified: job?.optimistic_verify ?? false,
        status: job?.verification_status ?? null,
      };
    }),

  /**
   * Fallback path: the backend-signed GameRegistry payload so a participant can
   * submit `finalizeSession` from their own wallet if the backend relayer
   * couldn't. The signature is reproduced deterministically, so it matches what
   * the backend would have sent; the contract dedupes double-submits.
   */
  finalizationPayload: playerProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Only the two participants may fetch the signed payload.
      const participant = await prisma.session_players.findFirst({
        where: {
          session_id: input.sessionId,
          player_address: ctx.playerAddress,
        },
        select: { id: true },
      });
      if (!participant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a participant in this session",
        });
      }
      return getFinalizationPayload(input.sessionId);
    }),
});
