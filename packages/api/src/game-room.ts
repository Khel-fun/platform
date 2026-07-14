// ---------------------------------------------------------------------------
// In-memory game room store
//
// The authoritative live state for an active Card Wars match lives here, keyed
// by session id. Dealt hands are NOT persisted in the database (the schema only
// stores merkle roots), so they are held here and are recomputable from the
// session seed via `deal_cards` if the process restarts.
//
// Durable checkpoints (seed, roots, per-round scores, winner) are written to
// Postgres by the session/engine layer; this store holds the volatile parts:
// the concealed hands, the current round's pending plays, timers, and the
// per-room event bus that drives the live subscription.
//
// MVP targets a single server instance. Scaling to multiple instances would
// move this state behind Redis (see roadmap Phase 4).
// ---------------------------------------------------------------------------

import { EventEmitter } from "node:events";

export type RoomStatus = "IN_PROGRESS" | "FINISHED";

/** Total rounds per match (one per dealt card). */
export const TOTAL_ROUNDS = 7;
/** Per-round window before the unplayed side forfeits the round (ms). */
export const ROUND_MS = 10_000;

export type PlayerSlot = {
  /** Player address (matches `players.id`). */
  address: string;
  /** The 7 dealt card numbers (0–51), in dealt order. */
  hand: number[];
  /** Parallel to `hand`: whether each card has been played this game. */
  played: boolean[];
  /** Accumulated XP this session. */
  xp: number;
};

/** A card committed by a player for the current round. */
export type Play = { handIndex: number; cardNumber: number };

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
 * Events broadcast to a room's subscribers. A single emitter channel ("event")
 * carries the discriminated union so the subscription can fan it out verbatim.
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

export type GameRoom = {
  sessionId: string;
  gameId: string;
  deckRoot: string;
  /** `players[0]` joined first (player 1); `players[1]` is player 2. */
  players: [PlayerSlot, PlayerSlot];
  /** 1-based round counter, 1..TOTAL_ROUNDS. */
  currentRound: number;
  status: RoomStatus;
  /** True once round 1 has begun (set when both players have subscribed). */
  started: boolean;
  /** This round's committed plays by slot. */
  pending: [Play | null, Play | null];
  /** Resolved rounds so far. */
  results: RoundResult[];
  /** Epoch ms the current round auto-resolves, or null between rounds. */
  deadline: number | null;
  /** Active round timer handle. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Live subscriber count (gates game start and informs teardown). */
  subscribers: number;
  /** Guard so only one fairness poller runs per room. */
  fairnessWatched: boolean;
  /** Per-room event bus consumed by the live subscription. */
  events: EventEmitter;
};

const rooms = new Map<string, GameRoom>();

/** Build a fresh player slot from a dealt hand. */
export function makePlayerSlot(address: string, hand: number[]): PlayerSlot {
  return {
    address,
    hand,
    played: hand.map(() => false),
    xp: 0,
  };
}

/** Construct a new, unstarted room for a freshly dealt session. */
export function createRoom(args: {
  sessionId: string;
  gameId: string;
  deckRoot: string;
  players: [PlayerSlot, PlayerSlot];
}): GameRoom {
  return {
    ...args,
    currentRound: 1,
    status: "IN_PROGRESS",
    started: false,
    pending: [null, null],
    results: [],
    deadline: null,
    timer: null,
    subscribers: 0,
    fairnessWatched: false,
    events: new EventEmitter(),
  };
}

export function setRoom(room: GameRoom): void {
  rooms.set(room.sessionId, room);
}

export function getRoom(sessionId: string): GameRoom | undefined {
  return rooms.get(sessionId);
}

export function deleteRoom(sessionId: string): void {
  rooms.delete(sessionId);
}

/** Slot index (0 or 1) for `address`, or undefined if not a participant. */
export function slotIndex(room: GameRoom, address: string): number | undefined {
  const i = room.players.findIndex((p) => p.address === address);
  return i === -1 ? undefined : i;
}

/** Return the slot belonging to `address`, or undefined if not in this room. */
export function findSlot(
  room: GameRoom,
  address: string,
): PlayerSlot | undefined {
  return room.players.find((p) => p.address === address);
}

/** Emit a typed event to the room's subscribers. */
export function emitRoomEvent(room: GameRoom, event: GameEvent): void {
  room.events.emit("event", event);
}

/** Snapshot the current room state for a newly connected subscriber. */
export function roomSnapshot(room: GameRoom): GameEvent {
  return {
    type: "state",
    round: room.currentRound,
    status: room.status,
    totals: [room.players[0].xp, room.players[1].xp],
    results: room.results,
  };
}
