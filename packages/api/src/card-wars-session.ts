// ---------------------------------------------------------------------------
// Card Wars session creation
//
// Orchestrates the deal + fairness handoff once two players are paired:
//   1. fetch a verifiable random seed from Kurier        (getRandomSeed)
//   2. deal a shuffled deck + both hands + merkle roots   (deal_cards)
//   3. persist the durable session state to Postgres      (one transaction)
//   4. enqueue the shuffle proof job (async, decoupled)    (enqueueProof)
//   5. build the in-memory GameRoom holding the hands      (setRoom)
//
// The proof runs asynchronously in the BullMQ worker; gameplay never blocks on
// it. The "Fairness Verified" signal is derived later from `verification_jobs`.
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import prisma from "@platform/db";
import { getRandomSeed } from "@platform/proving-setup";
import { deal_cards, hand_merkle_tree } from "@platform/proving-setup/card-wars";
import { createLogger } from "@platform/config/logger";
import { enqueueProof } from "./proof-queue";
import { createRoom, makePlayerSlot, setRoom } from "./game-room";

const log = createLogger("card-wars-session");

const GAME_NAME = "card-wars";
const SHUFFLE_CIRCUIT = "shuffle";

/** Decode a circuit Field (hex string) into the card number it represents. */
function fieldToCardNumber(field: string): number {
  return Number(BigInt(field));
}

/**
 * Create a Card Wars session for a freshly matched pair.
 *
 * `player1Address` joined the lobby first (dealt the first 7 cards),
 * `player2Address` is the joiner who triggered the match.
 *
 * @returns the new session id.
 */
export async function createCardWarsSession(
  player1Address: string,
  player2Address: string,
): Promise<string> {
  // Wallet addresses are always persisted lowercase; normalize once up front so
  // the DB rows and the in-memory room slots share the same canonical identity.
  player1Address = player1Address.toLowerCase();
  player2Address = player2Address.toLowerCase();

  // Resolve the seeded game + shuffle circuit rows (FK targets for the proof).
  const game = await prisma.games.findUnique({ where: { name: GAME_NAME } });
  if (!game) {
    throw new Error(`[SESSION] Missing seeded game "${GAME_NAME}"`);
  }
  const circuit = await prisma.circuits.findFirst({
    where: { game_id: game.id, circuit_name: SHUFFLE_CIRCUIT },
  });
  if (!circuit) {
    throw new Error(`[SESSION] Missing seeded circuit "${SHUFFLE_CIRCUIT}"`);
  }

  // 1. Verifiable randomness, then 2. deal from it.
  const { seed, seed_job_id } = await getRandomSeed();
  const [shuffled, deckRoot, , player1HandFields, player2HandFields] =
    await deal_cards(seed);

  const player1Hand = player1HandFields.map(fieldToCardNumber);
  const player2Hand = player2HandFields.map(fieldToCardNumber);

  // Commit roots for each player's hand (the deck root is committed by the
  // shuffle proof; hand roots let a player later prove hand membership).
  const [player1HandRoot] = await hand_merkle_tree(player1Hand.map(String));
  const [player2HandRoot] = await hand_merkle_tree(player2Hand.map(String));

  // 3. Durable checkpoint — session + card-wars state + both players.
  const sessionId = randomUUID();
  const now = new Date();
  await prisma.$transaction([
    prisma.game_sessions.create({
      data: { id: sessionId, game_id: game.id, status: "IN_PROGRESS", updated_at: now },
    }),
    prisma.card_wars_sessions.create({
      data: {
        id: randomUUID(),
        session_id: sessionId,
        seed,
        seed_job_id,
        deck_merkle_root: deckRoot,
        player_hands_roots: [player1HandRoot, player2HandRoot],
        // Positional: index i pairs with player_hands_roots[i]. Fixes the
        // canonical A/B order used by on-chain finalization (player1 = A).
        player_addresses: [player1Address, player2Address],
        score: [],
        updated_at: now,
      },
    }),
    prisma.session_players.create({
      data: {
        id: randomUUID(),
        session_id: sessionId,
        player_address: player1Address,
        updated_at: now,
      },
    }),
    prisma.session_players.create({
      data: {
        id: randomUUID(),
        session_id: sessionId,
        player_address: player2Address,
        updated_at: now,
      },
    }),
  ]);
  log.info(`[SESSION] Created session ${sessionId} (${game.id})`);

  // 4. Hand the shuffle off to the proof pipeline (async — does not block play).
  await enqueueProof({
    type: "CARD_WARS_SHUFFLE",
    gameId: game.id,
    sessionId,
    circuitId: circuit.id,
    seed,
    shuffled_deck: shuffled,
  });

  // 5. Hold the concealed hands in memory for live play. Round 1 begins once
  //    both players have subscribed to the room (see subscribeRoom).
  const room = createRoom({
    sessionId,
    gameId: game.id,
    deckRoot,
    players: [
      makePlayerSlot(player1Address, player1Hand),
      makePlayerSlot(player2Address, player2Hand),
    ],
  });
  setRoom(room);

  return sessionId;
}
