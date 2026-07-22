// ---------------------------------------------------------------------------
// Card Wars tRPC contract (types only)
//
// The Card Wars backend now lives in its own repository (the standalone
// `card-war` game, deployed independently) and is reached over
// `VITE_CARD_WARS_BACKEND_URL` (see `utils/trpc.ts`). The web client still needs
// the *type* of that backend's tRPC router to stay end-to-end type-safe, so we
// mirror the backend's `cardWars` router here. The resolvers below are stubs —
// they are never executed in the browser; the running server answers every
// call over the HTTP/WebSocket transport. Keep this in sync with the backend
// router (card-war `packages/api/src/routers/card-wars.ts`).
// ---------------------------------------------------------------------------

import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type { Hex } from "viem";

import type { SerializedResult } from "../utils/registry";

/** Live match status. */
export type RoomStatus = "IN_PROGRESS" | "FINISHED";

/** A resolved round's public outcome, indexed by player slot (0 and 1). */
export type RoundResult = {
  round: number;
  /** Revealed cards by slot (`null` = the player timed out that round). */
  cards: [number | null, number | null];
  /** XP awarded this round by slot. */
  roundXp: [number, number];
  /** Running totals by slot after this round. */
  totals: [number, number];
};

/**
 * Events pushed over the live room subscription. A discriminated union on
 * `type` so the client can `switch` and narrow each event exhaustively.
 */
export type GameEvent =
  | {
      type: "state";
      round: number;
      status: RoomStatus;
      totals: [number, number];
      results: RoundResult[];
    }
  | { type: "round:start"; round: number; deadline: number }
  | { type: "card:played"; slot: number; round: number }
  | {
      type: "round:reveal";
      round: number;
      cards: [number | null, number | null];
      roundXp: [number, number];
      totals: [number, number];
    }
  | {
      type: "game:over";
      round: number;
      totals: [number, number];
      winner: string | null;
      isDraw: boolean;
    }
  | { type: "fairness"; verified: boolean; status: string | null };

/** Matchmaking result for `joinQueue` / `pollMatch`. */
export type QueueResult =
  | { status: "matched"; sessionId: string }
  | { status: "waiting" };

/** One card in the caller's private hand. */
export type HandCard = {
  /** Hand slot index (0–6), used to play a specific card. */
  index: number;
  /** Card number 0–51; also the face asset index (card_faces/NN.png). */
  number: number;
  played: boolean;
  rank: number;
  suit: number;
};

/** The caller's own hand + slot for a session (never the opponent's cards). */
export type MyHand = {
  slot: number;
  round: number;
  status: RoomStatus;
  hand: HandCard[];
};

/** Backend-signed GameRegistry payload for the on-chain finalize fallback. */
export type FinalizationPayload =
  | { configured: false }
  | {
      configured: true;
      contractAddress: Hex;
      chainId: number;
      alreadyFinalized: boolean;
      signature: Hex;
      result: SerializedResult;
    };

const t = initTRPC.create();
const publicProcedure = t.procedure;

/**
 * Type-only mirror of the backend `cardWars` router. Inputs are validated with
 * the same zod shapes the backend uses; outputs are typed stubs so the client
 * infers exact return types. None of these resolvers run in the browser.
 */
const cardWarsRouter = t.router({
  joinQueue: publicProcedure.mutation((): QueueResult => ({ status: "waiting" })),
  pollMatch: publicProcedure.query((): QueueResult => ({ status: "waiting" })),
  getMyHand: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query((): MyHand => ({ slot: 0, round: 1, status: "IN_PROGRESS", hand: [] })),
  playCard: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        handIndex: z.number().int().min(0).max(6),
      }),
    )
    .mutation((): { ok: true } => ({ ok: true })),
  subscribeRoom: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(async function* (): AsyncGenerator<GameEvent, void, unknown> {
      // Contract only — the backend streams the real room events.
      return;
    }),
  finalizationPayload: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query((): FinalizationPayload => ({ configured: false })),
});

const contractRouter = t.router({
  healthCheck: publicProcedure.query((): string => "OK"),
  cardWars: cardWarsRouter,
});

/** The Card Wars backend router type the web client is typed against. */
export type AppRouter = typeof contractRouter;
