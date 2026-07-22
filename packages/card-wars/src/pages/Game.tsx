import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useAccount } from "wagmi";

import {
  emptySlot,
  gameRoomBgDesktop,
  gameRoomBgMobile,
  gameRoomShadersDesktop,
  gameRoomShadersMobile,
  loserAvatar,
  winnerAvatar,
} from "@platform/ui/lib/assets";
import { cn } from "@platform/ui/lib/utils";
import { PlayingCard } from "@platform/ui/components/playing-card";

import { FinalizeOnChain } from "../components/finalize-on-chain";
import {
  CardWarsTitle,
  pillButtonClass,
  truncateAddress,
} from "../components/game-ui";
import { trpc } from "../utils/trpc";

type Reveal = {
  round: number;
  cards: [number | null, number | null];
  roundXp: [number, number];
};

type ResultTone = "win" | "loss" | "draw";

/** After this long without an `optimistic_verify`, treat fairness as failed. */
const FAIRNESS_TIMEOUT_MS = 125_000;

export default function CardWarsGame({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const { address } = useAccount();

  const hand = useQuery({
    ...trpc.cardWars.getMyHand.queryOptions({ sessionId }),
    retry: false,
  });

  // The callback closes over identity, so keep the slot in a ref it can read.
  const slotRef = useRef(0);
  slotRef.current = hand.data?.slot ?? 0;

  const [round, setRound] = useState(1);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [totals, setTotals] = useState<[number, number]>([0, 0]);
  const [started, setStarted] = useState(false);
  const [opponentPlayed, setOpponentPlayed] = useState(false);
  const [playedThisRound, setPlayedThisRound] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [playedIndices, setPlayedIndices] = useState<Set<number>>(new Set());
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [fairnessVerified, setFairnessVerified] = useState(false);

  useSubscription(
    trpc.cardWars.subscribeRoom.subscriptionOptions(
      { sessionId },
      {
        enabled: Boolean(hand.data),
        onData: (event) => {
          switch (event.type) {
            case "state":
              setRound(event.round);
              setTotals(event.totals);
              setStarted(event.status !== "FINISHED");
              if (event.status === "FINISHED") setGameOver(true);
              if (event.results.length > 0) {
                const last = event.results[event.results.length - 1]!;
                setReveal({
                  round: last.round,
                  cards: last.cards,
                  roundXp: last.roundXp,
                });
              }
              break;
            case "round:start":
              setRound(event.round);
              setDeadline(event.deadline);
              setStarted(true);
              setPlayedThisRound(false);
              setOpponentPlayed(false);
              setSelected(null);
              setReveal(null);
              break;
            case "card:played":
              if (event.slot !== slotRef.current) setOpponentPlayed(true);
              break;
            case "round:reveal":
              setTotals(event.totals);
              setReveal({
                round: event.round,
                cards: event.cards,
                roundXp: event.roundXp,
              });
              setDeadline(null);
              setOpponentPlayed(false);
              break;
            case "game:over":
              setTotals(event.totals);
              setGameOver(true);
              setDeadline(null);
              break;
            case "fairness":
              setFairnessVerified(event.verified);
              break;
          }
        },
      },
    ),
  );

  // Per-round countdown.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    if (deadline == null) {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline]);

  // Reveal choreography: both covered → faces shown → winner highlighted.
  const [revealPhase, setRevealPhase] = useState<
    "covered" | "faces" | "evaluated" | null
  >(null);
  useEffect(() => {
    if (!reveal) {
      setRevealPhase(null);
      return;
    }
    setRevealPhase("covered");
    const t1 = setTimeout(() => setRevealPhase("faces"), 350);
    const t2 = setTimeout(() => setRevealPhase("evaluated"), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reveal?.round]);

  const play = useMutation(trpc.cardWars.playCard.mutationOptions());

  const mySlot = hand.data?.slot ?? 0;
  const oppSlot = mySlot === 0 ? 1 : 0;
  const myXp = totals[mySlot] ?? 0;
  const oppXp = totals[oppSlot] ?? 0;
  const canPlay = started && !gameOver && !playedThisRound;

  const handlePlay = (index: number) => {
    if (!canPlay || playedIndices.has(index)) return;
    setSelected(index);
    setPlayedThisRound(true);
    setPlayedIndices((prev) => new Set(prev).add(index));
    play.mutate({ sessionId, handIndex: index });
  };

  const myReveal = reveal ? reveal.cards[mySlot] : null;
  const oppReveal = reveal ? reveal.cards[oppSlot] : null;

  const facesUp = revealPhase === "faces" || revealPhase === "evaluated";
  const evaluated = revealPhase === "evaluated";
  const roundWinner: "me" | "opp" | "tie" | null = reveal
    ? reveal.roundXp[mySlot] > reveal.roundXp[oppSlot]
      ? "me"
      : reveal.roundXp[mySlot] < reveal.roundXp[oppSlot]
        ? "opp"
        : "tie"
    : null;

  const slotState = (side: "me" | "opp") => {
    const cardNum = side === "me" ? myReveal : oppReveal;
    const hasPlayed =
      side === "me" ? playedThisRound || !!reveal : opponentPlayed || !!reveal;
    if (facesUp && cardNum != null) return { kind: "face" as const, cardNum };
    if (hasPlayed) return { kind: "cover" as const };
    return { kind: "empty" as const };
  };

  const seconds = remainingMs == null ? 0 : Math.ceil(remainingMs / 1000);
  const liveHand = (hand.data?.hand ?? []).filter(
    (card) => !playedIndices.has(card.index),
  );

  if (hand.isError) {
    return (
      <div className="relative h-svh w-full overflow-hidden bg-[#0f100f]">
        <Background />
        <CardWarsTitle
          oneLine
          className="absolute left-1/2 top-16 z-10 -translate-x-1/2 whitespace-nowrap text-[32px] leading-[22px] sm:top-14"
        />
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/45 px-6 text-center backdrop-blur-[2px]">
          <p className="font-pixel text-[32px] leading-[22px] text-white">
            SESSION EXPIRED
          </p>
          <p className="max-w-sm font-ui text-sm leading-6 text-white/60">
            This match is no longer active. Start a fresh match to continue.
          </p>
          <Link to="/game/card-wars" replace className={pillButtonClass}>
            <Home className="size-4" />
            home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-svh w-full overflow-hidden bg-[#0f100f]">
      <Background />

      <button
        type="button"
        onClick={() => navigate({ to: "/game/card-wars" })}
        className="absolute left-6 top-16 z-20 flex size-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
        title="Leave game"
      >
        <ArrowLeft className="size-5" />
      </button>

      <div className="cw-game-stage z-10">
        <CardWarsTitle
          oneLine
          className="absolute left-1/2 top-16 z-10 -translate-x-1/2 whitespace-nowrap text-[32px] leading-[22px] sm:top-14"
        />

        <main className="absolute inset-0 z-10">
          <ScoreLabel
            label="OPPONENT"
            score={oppXp}
            className="left-4 top-[134px] items-start sm:left-[calc(50%-234px)] sm:top-[122px]"
          />
          <ScoreLabel
            label="YOU"
            score={myXp}
            className="right-4 top-[234px] items-end sm:right-[calc(50%-260px)] sm:top-[241px]"
          />

          <PlayerSlot
            state={slotState("opp")}
            className="left-[23px] top-[205px] sm:left-[calc(50%-211px)] sm:top-[238px]"
            tilt="-rotate-6"
            highlight={
              evaluated ? (roundWinner === "opp" ? "win" : "lose") : null
            }
          />
          <PlayerSlot
            state={slotState("me")}
            className="right-[8px] top-[295px] sm:right-[calc(50%-214px)] sm:top-[351px]"
            tilt="rotate-6"
            highlight={
              evaluated ? (roundWinner === "me" ? "win" : "lose") : null
            }
          />

          {started && !gameOver && (
            <div className="absolute bottom-[240px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 sm:bottom-[198px]">
              <span className="rounded-[32px] bg-[#364540] px-[10px] pb-[3px] pt-1 font-ui text-xs font-medium leading-[22px] tabular-nums text-white shadow-lg">
                {`00:${String(seconds).padStart(2, "0")}`}
              </span>
              {!reveal && (
                <span className="font-ui text-xs text-white/45">
                  {playedThisRound ? "waiting for opponent ..." : "play a card"}
                </span>
              )}
            </div>
          )}

          {!started && !gameOver && (
            <p className="absolute bottom-[240px] left-1/2 -translate-x-1/2 font-ui text-sm text-white/50 sm:bottom-[198px]">
              waiting for both players ...
            </p>
          )}
        </main>

        <footer className="absolute inset-x-0 bottom-[92px] z-10 flex justify-center sm:bottom-[46px]">
          <div className="flex items-end justify-center">
            {liveHand.map((card, i) => {
              const fromCenter = i - (liveHand.length - 1) / 2;
              return (
                <div
                  key={card.index}
                  className="-ml-12 first:ml-0 sm:-ml-8"
                  style={{
                    transform: `rotate(${fromCenter * -3}deg) translateY(${Math.abs(fromCenter) * 3}px)`,
                  }}
                >
                  <PlayingCard
                    number={card.number}
                    selected={selected === card.index}
                    disabled={!canPlay}
                    onClick={() => handlePlay(card.index)}
                    className="w-[98px] rounded-md border-0 bg-transparent shadow-none sm:w-[76px]"
                  />
                </div>
              );
            })}
          </div>
        </footer>
      </div>

      {/* Game over. */}
      {gameOver && (
        <GameOverModal
          won={myXp > oppXp}
          draw={myXp === oppXp}
          xp={myXp}
          address={address ?? null}
          fairnessVerified={fairnessVerified}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

function Background() {
  return (
    <>
      <img
        src={gameRoomBgDesktop}
        alt=""
        aria-hidden
        className="cw-game-bg hidden object-cover sm:block"
        draggable={false}
      />
      <img
        src={gameRoomBgMobile}
        alt=""
        aria-hidden
        className="absolute inset-0 block h-full w-full object-cover sm:hidden"
        draggable={false}
      />
      <div className="cw-game-art pointer-events-none hidden opacity-80 sm:block">
        <img
          src={gameRoomShadersDesktop}
          alt=""
          aria-hidden
          className="h-full w-full object-fill"
          draggable={false}
        />
      </div>
      <img
        src={gameRoomShadersMobile}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 block h-full w-full object-cover opacity-70 sm:hidden"
        draggable={false}
      />
    </>
  );
}

type SlotState =
  | { kind: "empty" }
  | { kind: "cover" }
  | { kind: "face"; cardNum: number };

function ScoreLabel({
  label,
  score,
  className,
}: {
  label: string;
  score: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex flex-col font-pixel leading-[22px] text-white",
        className,
      )}
    >
      <span className="text-[32px] tabular-nums">
        {String(score).padStart(3, "0")}
      </span>
      <span className="mt-3 text-[20px] uppercase text-white/80">{label}</span>
    </div>
  );
}

function PlayerSlot({
  state,
  className,
  tilt,
  highlight,
}: {
  state: SlotState;
  className?: string;
  tilt: string;
  highlight: "win" | "lose" | null;
}) {
  return (
    <div className={cn("absolute", className)}>
      <div
        className={cn(
          "transition-all duration-500",
          tilt,
          highlight === "win" &&
            "relative z-20 scale-115 drop-shadow-[0_0_32px_rgba(255,255,255,0.45)]",
          highlight === "lose" && "scale-85 opacity-35 grayscale",
        )}
      >
        {state.kind === "empty" ? (
          <div
            className={cn(
              "aspect-5/7 w-[152px] overflow-hidden rounded-lg border border-white/10 sm:w-[150px]",
            )}
          >
            {emptySlot && (
              <img
                src={emptySlot}
                alt=""
                className="h-full w-full object-cover opacity-10"
                draggable={false}
              />
            )}
          </div>
        ) : state.kind === "cover" ? (
          <PlayingCard
            faceDown
            className="w-[152px] rounded-lg border-0 bg-transparent shadow-none sm:w-[150px]"
          />
        ) : (
          <PlayingCard
            number={state.cardNum}
            className={cn(
              "w-[152px] rounded-lg border-0 bg-transparent shadow-none sm:w-[150px]",
              highlight === "win" && "ring-4 ring-white/80",
            )}
          />
        )}
      </div>
    </div>
  );
}

function GameOverModal({
  won,
  draw,
  xp,
  address,
  fairnessVerified,
  sessionId,
}: {
  won: boolean;
  draw: boolean;
  xp: number;
  address: string | null;
  fairnessVerified: boolean;
  sessionId: string;
}) {
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const goHome = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (leaving) return;

    setLeaving(true);
    void navigate({ to: "/game/card-wars", replace: true });

    // Belt-and-suspenders fallback: if a wallet/game event re-renders this route
    // before the router transition completes, force the home route.
    window.setTimeout(() => {
      if (window.location.pathname !== "/game/card-wars") {
        window.location.assign("/game/card-wars");
      }
    }, 150);
  };

  // Hold the "verifying" bar for at least 2s; fall back to "failed" only after a
  // long wait (the server keeps polling optimistic_verify for ~120s).
  const [holdElapsed, setHoldElapsed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setHoldElapsed(true), 2000);
    const b = setTimeout(() => setTimedOut(true), FAIRNESS_TIMEOUT_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const verifying = !fairnessVerified && !timedOut;
  const resolved = holdElapsed && !verifying;
  const failed = resolved && !fairnessVerified;

  const result = draw ? "DRAW" : won ? "YOU WON!" : "OPPONENT WON!";
  const resultTone: ResultTone = draw ? "draw" : won ? "win" : "loss";
  const resultBackgroundClass = {
    win: "bg-[#0d241a]",
    loss: "bg-[#2c1b18]",
    draw: "bg-[#242215]",
  } satisfies Record<ResultTone, string>;
  const resultGlowClass = {
    win: "bg-[radial-gradient(circle_at_28%_34%,rgba(64,142,104,0.42),transparent_30%),radial-gradient(circle_at_78%_62%,rgba(34,98,75,0.52),transparent_34%)]",
    loss: "bg-[radial-gradient(circle_at_28%_34%,rgba(90,61,51,0.45),transparent_30%),radial-gradient(circle_at_78%_62%,rgba(93,50,39,0.5),transparent_34%)]",
    draw: "bg-[radial-gradient(circle_at_28%_34%,rgba(95,82,42,0.38),transparent_30%),radial-gradient(circle_at_78%_62%,rgba(87,73,30,0.46),transparent_34%)]",
  } satisfies Record<ResultTone, string>;
  const resultBorderClass = {
    win: "border-[#12875f]",
    loss: "border-[#bd3d23]",
    draw: "border-[#b89d13]",
  } satisfies Record<ResultTone, string>;
  const avatarAlt = draw ? "Draw" : won ? "Winner" : "Loser";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <div
        className={cn(
          "relative flex w-full max-w-[612px] flex-col overflow-visible rounded-[16px] border px-10 pb-10 pt-12 shadow-[0_24px_60px_rgba(0,0,0,0.75)]",
          resultBackgroundClass[resultTone],
          resultBorderClass[resultTone],
        )}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-[16px] opacity-80",
            resultGlowClass[resultTone],
          )}
        />
        <div className="absolute inset-0 overflow-hidden rounded-[16px] bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.42)_78%)]" />

        <div className="relative z-10 w-full text-center">
          <p className="font-button text-[32px] font-normal uppercase leading-[28px] tracking-[0.08em] text-white">
            DUEL OVER
          </p>
          <h2 className="mt-3 font-button text-[48px] font-normal uppercase leading-[44px] tracking-[0.04em] text-white drop-shadow-md">
            {result}
          </h2>

          <div className="mt-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="flex size-[62px] shrink-0 items-center justify-center rounded-[14px] bg-white p-1">
                <img
                  src={won ? winnerAvatar : loserAvatar}
                  alt={avatarAlt}
                  className="size-full rounded-[10px] object-cover"
                  draggable={false}
                />
              </div>
              <div className="flex flex-col justify-center text-left">
                <p className="font-button text-[34px] font-normal leading-[30px] tracking-[0.04em] text-white">
                  YOU
                </p>
                {address && (
                  <p className="mt-1 font-ui text-[22px] font-medium leading-[24px] tracking-wide text-white/85">
                    {truncateAddress(address)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center text-right">
              <span className="font-button text-[34px] font-normal leading-[30px] tracking-[0.04em] text-white">
                {xp} XP
              </span>
            </div>
          </div>

          {/* Fairness status. */}
          <div className="mt-16">
            {!resolved ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-[4px] w-[414px] max-w-full overflow-hidden rounded-full bg-white/70">
                  <div className="cw-verify-sweep absolute inset-y-0 w-[40px] bg-emerald-400" />
                </div>
                <p className="font-ui text-[22px] font-normal leading-[24px] tracking-wide text-white/80">
                  verifying fairness ...
                </p>
              </div>
            ) : failed ? (
              <p className="font-ui text-[22px] font-normal leading-[24px] text-red-400">
                Proofs failed!
              </p>
            ) : (
              <p className="font-ui text-[22px] font-normal leading-[24px] text-[#20ffc2] drop-shadow-[0_0_8px_rgba(32,255,194,0.25)]">
                Proofs verified!
              </p>
            )}
          </div>

          {/* Winner may submit the result on-chain if the relayer hasn't. */}
          {resolved && fairnessVerified && won && (
            <div className="mx-auto mt-6 w-full max-w-[438px]">
              <FinalizeOnChain sessionId={sessionId} />
            </div>
          )}
        </div>

        {resolved && (
          <div className="absolute bottom-[-86px] left-1/2 flex -translate-x-1/2 justify-center">
            <button
              type="button"
              disabled={leaving}
              className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-2 rounded-[36px] border border-white/15 bg-[#354843]/85 px-[18px] py-[8px] font-ui text-[13px] font-medium lowercase text-white shadow-lg backdrop-blur-md transition-colors hover:bg-[#405650]"
              onPointerDown={goHome}
              onClick={goHome}
            >
              <Home className="size-3.5" />
              home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
