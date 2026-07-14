import { Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import {
  emptySlot,
  gameRoomBgDesktop,
  gameRoomBgMobile,
  gameRoomShadersDesktop,
  gameRoomShadersMobile,
} from "@platform/ui/lib/assets";
import { PlayingCard } from "@platform/ui/components/playing-card";

import { CardWarsTitle, pillButtonClass, truncateAddress } from "../components/game-ui";
import { getCardWarsSocket } from "../lib/socket";

type CardValue = { rank: number; suit: string } | null;

type CardFlipPayload = {
  roundNumber: number;
  player1Card?: CardValue;
  player2Card?: CardValue;
  winner?: string | null;
  cardCounts?: Record<string, number>;
};

type GameStartPayload = {
  gameId: string;
  player1Id?: string;
  player2Id?: string;
  cardCounts?: Record<string, number>;
};

function readInitialGame(): GameStartPayload | null {
  const raw = sessionStorage.getItem("cardWarsGame");
  if (!raw) return null;

  try {
    return JSON.parse(raw) as GameStartPayload;
  } catch {
    return null;
  }
}

function cardLabel(card: CardValue) {
  if (!card) return "Waiting";
  return `${card.rank} ${card.suit}`;
}

export default function CardWarsGame() {
  const { address } = useAccount();
  const [game, setGame] = useState<GameStartPayload | null>(() => readInitialGame());
  const [round, setRound] = useState<CardFlipPayload | null>(null);
  const [message, setMessage] = useState("Waiting for round...");
  const [gameWinner, setGameWinner] = useState<string | null>(null);

  const players = useMemo(() => {
    const ids = [game?.player1Id, game?.player2Id].filter(Boolean) as string[];
    if (ids.length > 0) return ids;
    return address ? [address] : [];
  }, [address, game]);

  useEffect(() => {
    const socket = getCardWarsSocket();
    const onGameStart = (payload: GameStartPayload) => {
      sessionStorage.setItem("cardWarsGame", JSON.stringify(payload));
      setGame(payload);
      setMessage("Game started");
    };
    const onCardFlip = (payload: CardFlipPayload) => {
      setRound(payload);
      setMessage(payload.winner ? `Round ${payload.roundNumber} winner decided` : `Round ${payload.roundNumber}`);
    };
    const onGameEnd = (payload: { winner?: string; cardCounts?: Record<string, number>; roundNumber?: number }) => {
      setGameWinner(payload.winner ?? null);
      if (payload.cardCounts && game) setGame({ ...game, cardCounts: payload.cardCounts });
      setMessage("Game finished");
    };
    const onError = (error: { message?: string } | string) => {
      setMessage(typeof error === "string" ? error : error.message ?? "Card Wars backend error");
    };

    socket.on("game_start", onGameStart);
    socket.on("card_flip", onCardFlip);
    socket.on("game_end", onGameEnd);
    socket.on("error", onError);

    return () => {
      socket.off("game_start", onGameStart);
      socket.off("card_flip", onCardFlip);
      socket.off("game_end", onGameEnd);
      socket.off("error", onError);
    };
  }, [game]);

  const flipCard = () => {
    if (!game?.gameId) return;
    getCardWarsSocket().emit("flip_card", { gameId: game.gameId });
    setMessage("Card submitted. Waiting for opponent...");
  };

  return (
    <div className="relative flex h-svh w-full flex-col overflow-hidden text-white">
      <img src={gameRoomBgDesktop} alt="" aria-hidden className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      <img src={gameRoomBgMobile} alt="" aria-hidden className="absolute inset-0 block h-full w-full object-cover sm:hidden" />
      <img src={gameRoomShadersDesktop} alt="" aria-hidden className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      <img src={gameRoomShadersMobile} alt="" aria-hidden className="absolute inset-0 block h-full w-full object-cover sm:hidden" />

      <Link
        to="/game/card-wars"
        className="absolute left-6 top-16 z-20 flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="size-5" />
      </Link>

      <main className="relative z-10 flex min-h-full flex-col items-center justify-center gap-8 px-6 text-center">
        <CardWarsTitle className="text-6xl sm:text-7xl" />

        {!game ? (
          <div className="flex flex-col items-center gap-5">
            <Loader2 className="size-10 animate-spin text-[#2AC390]" />
            <p className="font-ui text-xl uppercase tracking-widest text-white/70">
              Waiting for independent backend session...
            </p>
          </div>
        ) : (
          <>
            <div className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
              {players.map((player, index) => {
                const card = (index === 0 ? round?.player1Card : round?.player2Card) ?? null;
                const score = game.cardCounts?.[player] ?? 0;
                const isWinner = gameWinner === player;
                return (
                  <section key={player} className="rounded-3xl border border-white/10 bg-black/45 p-6 backdrop-blur">
                    <p className="font-ui text-sm uppercase tracking-widest text-white/50">
                      {address?.toLowerCase() === player.toLowerCase() ? "You" : "Opponent"}
                    </p>
                    <p className="mt-2 font-ui text-lg text-white">{truncateAddress(player)}</p>
                    <div className="mx-auto mt-6 flex h-44 w-32 items-center justify-center rounded-2xl bg-black/35">
                      {card ? (
                        <PlayingCard number={card.rank} />
                      ) : (
                        <img src={emptySlot} alt="" className="h-full w-full object-contain opacity-60" />
                      )}
                    </div>
                    <p className="mt-4 font-ui text-xl text-white/80">{cardLabel(card)}</p>
                    <p className="mt-2 font-ui text-sm uppercase tracking-widest text-white/50">Score {score}</p>
                    {isWinner ? <p className="mt-3 font-ui text-[#2AC390]">Winner</p> : null}
                  </section>
                );
              })}
            </div>

            <p className="font-ui text-xl uppercase tracking-widest text-white/70">{message}</p>
            <button type="button" className={pillButtonClass} onClick={flipCard} disabled={Boolean(gameWinner)}>
              flip card
            </button>
          </>
        )}
      </main>
    </div>
  );
}
