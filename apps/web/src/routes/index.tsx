import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ChevronDown, CircleUserRound, PartyPopper, Sparkles, Trophy } from "lucide-react";
import { useAccount } from "wagmi";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const GAMES = [
  {
    id: "card-wars",
    name: "Card-Wars",
    to: "/game/card-wars",
    image: "/card-wars.png",
  },
  {
    id: "speed-o-light",
    name: "Speed-o-Light",
    to: "/game/speed-o-light",
    image: "/speed-o-light.png",
  },
  {
    id: "zk-mines",
    name: "zk Mines",
    to: "/game/zk-mines",
    image: "/zkMines.png",
  },
] as const;

const GAME_FILTERS = ["All Games", ...GAMES.map((game) => game.name)] as const;
type GameFilter = (typeof GAME_FILTERS)[number];

const medalStyles = {
  gold: "from-[#ffc86a] via-[#f7992f] to-[#674315]",
  silver: "from-[#ccd6ff] via-[#8da4e6] to-[#394671]",
  bronze: "from-[#d98f54] via-[#a55d32] to-[#52321f]",
} as const;

type LeaderboardEntry = {
  rank: number;
  medal?: keyof typeof medalStyles;
  playerAddress: string;
  gameName: string;
  score: number;
  updatedAt: string;
  isCurrentPlayer?: boolean;
};

function getMedal(rank: number): LeaderboardEntry["medal"] {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return undefined;
}

function shortAddress(address: string) {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}....${address.slice(-4)}`;
}

function PodiumMedal({ rank, medal }: { rank: number; medal: keyof typeof medalStyles }) {
  return (
    <span className="relative flex size-7 items-end justify-center" aria-label={`Rank ${rank}`}>
      <span className="absolute left-[7px] top-0 h-3.5 w-2 rotate-[-28deg] rounded-[2px] bg-[#438eff]" />
      <span className="absolute right-[7px] top-0 h-3.5 w-2 rotate-[28deg] rounded-[2px] bg-[#3279e5]" />
      <span
        className={`relative flex size-5 items-center justify-center rounded-full bg-gradient-to-br ${medalStyles[medal]} text-[10px] font-black leading-none text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]`}
      >
        {rank}
      </span>
    </span>
  );
}

function HomePage() {
  const { address, isConnected } = useAccount();
  const [selectedGame, setSelectedGame] = useState<GameFilter>("All Games");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const connectedAddress = isConnected ? address : undefined;
  const leaderboardQuery = useQuery(
    trpc.leaderboard.list.queryOptions({
      game: selectedGame === "All Games" ? undefined : selectedGame,
      limit: 8,
      playerAddress: connectedAddress,
      playerWindow: 5,
    }),
  );
  const leaderboard = useMemo<LeaderboardEntry[]>(
    () =>
      (leaderboardQuery.data ?? []).map((entry) => ({
        ...entry,
        medal: getMedal(entry.rank),
      })),
    [leaderboardQuery.data],
  );

  useEffect(() => {
    const openLeaderboard = () => setLeaderboardOpen(true);
    const openFromHash = () => {
      if (window.location.hash === "#leaderboard") {
        setLeaderboardOpen(true);
      }
    };

    openFromHash();
    window.addEventListener("open-leaderboard", openLeaderboard);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.removeEventListener("open-leaderboard", openLeaderboard);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  useEffect(() => {
    if (!leaderboardOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeaderboardOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leaderboardOpen]);

  const closeLeaderboard = () => {
    setLeaderboardOpen(false);
    if (window.location.hash === "#leaderboard") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-[#050716] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_22%_24%,rgba(42,83,151,0.38),transparent_38%),radial-gradient(ellipse_at_74%_45%,rgba(141,52,80,0.3),transparent_34%),radial-gradient(ellipse_at_50%_93%,rgba(23,38,81,0.82),transparent_54%),linear-gradient(180deg,#071026_0%,#040617_48%,#080411_100%)]" />
        <div
          className="absolute inset-0 opacity-75"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 60px 120px, white, transparent), radial-gradient(1.5px 1.5px at 140px 80px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 220px 200px, white, transparent), radial-gradient(1.5px 1.5px at 300px 50px, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 380px 160px, white, transparent), radial-gradient(1px 1px at 460px 30px, white, transparent), radial-gradient(1.5px 1.5px at 540px 220px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 620px 100px, white, transparent), radial-gradient(1px 1px at 700px 180px, white, transparent), radial-gradient(1.5px 1.5px at 780px 40px, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 860px 220px, white, transparent), radial-gradient(1px 1px at 940px 90px, white, transparent), radial-gradient(1.5px 1.5px at 1020px 200px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 1100px 60px, white, transparent), radial-gradient(1px 1px at 1180px 180px, white, transparent), radial-gradient(2px 2px at 150px 320px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 420px 380px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 760px 340px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 1080px 400px, rgba(255,255,255,0.7), transparent)",
            backgroundRepeat: "repeat",
            backgroundSize: "1200px 600px",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_at_center,rgba(17,34,77,0.66),transparent_66%)]" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1160px] flex-col items-center px-5 pb-8 pt-[98px] sm:px-10 sm:pt-[126px] lg:px-[3vw]">
        <section id="about" className="flex w-full flex-col items-center">
          <div className="flex flex-col items-center">
            <img
              src="/khel-logo.png"
              alt="Khel.fun"
              className="h-[118px] w-auto drop-shadow-[0_0_30px_rgba(255,140,40,0.35)] sm:h-[176px] md:h-[206px]"
            />
          </div>

          <div id="games" className="mt-9 grid w-full grid-cols-1 gap-2 sm:mt-12 sm:grid-cols-3 sm:gap-3 lg:mt-14">
            {GAMES.map((game) => (
              <Link
                key={game.id}
                to={game.to}
                className="group relative overflow-hidden rounded-[6px] bg-[#120d1c] shadow-[0_24px_70px_rgba(0,0,0,0.44)] ring-1 ring-white/8 transition-transform duration-300 hover:-translate-y-1 hover:ring-white/18"
              >
                <div className="relative aspect-[16/12.2] w-full overflow-hidden">
                  <img
                    src={game.image}
                    alt={game.name}
                    className="absolute inset-0 h-full w-full object-cover brightness-[0.72] saturate-[0.94] transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/22 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-5 pt-11 sm:px-5">
                  <h2
                    className="text-[20px] font-bold tracking-[0.02em] text-white uppercase drop-shadow-lg sm:text-[24px] lg:text-[27px]"
                    style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                  >
                    {game.name}
                  </h2>
                  <span
                    className="shrink-0 rounded-full bg-gradient-to-r from-[#ff6f3c] to-[#ff9d3c] px-3 py-1.5 text-[8px] font-bold tracking-[0.06em] text-white uppercase shadow-[0_0_20px_rgba(255,111,60,0.32)] transition-transform group-hover:scale-105"
                    style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                  >
                    Play Now
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {leaderboardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-0 py-0 backdrop-blur-[2.5px] sm:px-6 sm:py-[7vh]"
          onClick={closeLeaderboard}
          role="presentation"
        >
          <section
            id="leaderboard"
            className="relative flex min-h-[100svh] w-full flex-col overflow-visible bg-[#080116]/98 px-5 pb-8 pt-7 shadow-[0_40px_120px_rgba(0,0,0,0.62)] ring-1 ring-white/5 sm:min-h-[626px] sm:max-w-[490px] sm:rounded-[34px] sm:px-12 sm:pb-10 sm:pt-[62px]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-title"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_18%,rgba(42,83,151,0.34),transparent_34%),radial-gradient(ellipse_at_74%_30%,rgba(141,52,80,0.28),transparent_35%),linear-gradient(180deg,#07102a_0%,#05031a_52%,#02000a_100%)] sm:rounded-[34px]" />
            <div
              className="absolute inset-0 opacity-55 sm:rounded-[34px]"
              style={{
                backgroundImage:
                  "radial-gradient(1px 1px at 18px 30px, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 74px 112px, rgba(255,255,255,0.72), transparent), radial-gradient(1.5px 1.5px at 146px 74px, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 236px 206px, rgba(255,255,255,0.82), transparent), radial-gradient(1.5px 1.5px at 318px 46px, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 390px 166px, rgba(255,255,255,0.78), transparent)",
                backgroundRepeat: "repeat",
                backgroundSize: "430px 360px",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_62%_32%,rgba(130,69,72,0.22),transparent_38%),radial-gradient(circle_at_58%_78%,rgba(85,37,57,0.2),transparent_46%)] sm:rounded-[34px]" />

            {connectedAddress ? (
              <div className="absolute right-[19%] top-0 z-20 flex size-16 -translate-y-[42%] items-center justify-center rounded-full bg-white p-1 shadow-[0_10px_35px_rgba(0,0,0,0.38)] sm:right-14">
                <div className="flex size-full items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffe0bd_0%,#c87e5c_36%,#171226_70%)] text-[#140718]">
                  <CircleUserRound className="size-9 text-white/92 drop-shadow-[0_1px_5px_rgba(0,0,0,0.42)]" />
                </div>
              </div>
            ) : null}

            <div className="relative z-10 flex min-h-[calc(100svh-60px)] flex-col sm:min-h-[524px]">
              <div className="mb-16 flex items-center justify-between sm:hidden">
                <img src="/khel-logo.png" alt="Khel.fun" className="h-11 w-auto" />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={closeLeaderboard}
                    className="text-[10px] font-medium text-white/85"
                    style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                  >
                    Games
                  </button>
                  <span
                    className="rounded-full bg-white px-4 py-2 text-[10px] font-bold text-[#070923]"
                    style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                  >
                    Leaderboard
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-5 sm:justify-between">
                <h1
                  id="leaderboard-title"
                  className="hidden text-[28px] font-black leading-none text-white sm:block sm:text-[30px]"
                  style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                >
                  LEADERBOARD
                </h1>
                <label className="relative shrink-0">
                  <span className="sr-only">Filter leaderboard by game</span>
                  <select
                    value={selectedGame}
                    onChange={(event) => setSelectedGame(event.target.value as GameFilter)}
                    className="h-10 min-w-[132px] appearance-none rounded-full bg-[#654386] pl-5 pr-10 text-center text-[11px] font-bold text-white/92 outline-none ring-1 ring-white/0 transition-colors hover:bg-[#705094] focus:ring-white/30"
                    style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                  >
                    {GAME_FILTERS.map((game) => (
                      <option key={game} value={game}>
                        {game}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-3.5 -translate-y-1/2 text-white/65" />
                </label>
              </div>

              <div className="mx-auto mt-6 w-full max-w-[382px] space-y-2 sm:mt-[59px]">
                {leaderboardQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="grid h-[50px] animate-pulse grid-cols-[46px_1fr_70px] items-center rounded-[4px] bg-white/8 px-6"
                    >
                      <span className="size-5 rounded-full bg-white/10" />
                      <span className="h-3 w-32 rounded-full bg-white/10" />
                      <span className="ml-auto h-3 w-10 rounded-full bg-white/10" />
                    </div>
                  ))
                ) : leaderboardQuery.isError ? (
                  <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[8px] border border-red-400/20 bg-red-500/8 px-6 text-center sm:min-h-[300px]">
                    <AlertCircle className="size-8 text-red-300" />
                    <h2 className="mt-4 text-base font-bold text-white">Leaderboard unavailable</h2>
                    <p className="mt-2 max-w-[300px] text-sm leading-6 text-white/55">
                      The scores API could not be reached. Check the server and database connection.
                    </p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[8px] border border-white/10 bg-white/5 px-6 text-center sm:min-h-[300px]">
                    <Trophy className="size-9 text-white/40" />
                    <h2 className="mt-4 text-base font-bold text-white">No scores yet</h2>
                    <p className="mt-2 max-w-[300px] text-sm leading-6 text-white/55">
                      Finish a verified game session and it will appear here.
                    </p>
                  </div>
                ) : (
                  leaderboard.map((entry, index) => {
                    const isPodium = entry.rank <= 3;
                    const isCurrentPlayer = Boolean(entry.isCurrentPlayer);
                    const hasRankGap = index > 0 && entry.rank > leaderboard[index - 1]!.rank + 1;

                    return (
                      <div
                        key={`${entry.rank}-${entry.playerAddress}-${entry.gameName}`}
                        className={hasRankGap || index === 3 ? "pt-7" : ""}
                      >
                        <div
                          className={[
                            "relative grid grid-cols-[50px_1fr_70px] items-center rounded-[4px] px-6 text-[12px]",
                            isPodium
                              ? "min-h-[50px] bg-[#5d516b]/90 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : "min-h-[34px] border-t border-white/8 bg-transparent text-white/52",
                            isCurrentPlayer
                              ? "border border-fuchsia-400/80 bg-[#52446d]/92 text-white shadow-[0_0_22px_rgba(217,70,239,0.26)]"
                              : "",
                          ].join(" ")}
                          style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                        >
                          {isCurrentPlayer ? (
                            <>
                              <PartyPopper className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rotate-[-18deg] text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]" />
                              <Sparkles className="absolute -right-3 -top-2 size-6 rotate-12 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                            </>
                          ) : null}
                          <div className="flex items-center">
                            {entry.medal ? (
                              <PodiumMedal rank={entry.rank} medal={entry.medal} />
                            ) : (
                              <span className={isCurrentPlayer ? "text-[13px] font-black" : "text-[13px] font-semibold"}>
                                #{String(entry.rank).padStart(2, "0")}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={[
                                "truncate",
                                isPodium || isCurrentPlayer ? "font-bold text-white" : "font-medium",
                              ].join(" ")}
                            >
                              {shortAddress(entry.playerAddress)}
                            </div>
                          </div>
                          <span
                            className={[
                              "text-right text-[13px] font-bold tabular-nums",
                              isPodium || isCurrentPlayer ? "text-white" : "text-white/68",
                            ].join(" ")}
                          >
                            {entry.score.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={["mt-auto justify-center", leaderboard.length > 0 ? "hidden pt-0 sm:hidden" : "flex pt-8"].join(" ")}>
                <ConnectButton.Custom>
                  {({ account, mounted, openConnectModal }) => {
                    const hasWallet = mounted && (Boolean(account) || Boolean(connectedAddress));
                    if (!hasWallet) {
                      return (
                        <button
                          type="button"
                          onClick={openConnectModal}
                          disabled={!mounted}
                          className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-[13px] font-bold text-white shadow-[0_0_26px_rgba(34,211,238,0.25)] ring-1 ring-white/70 transition-transform hover:scale-105 disabled:opacity-50"
                          style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                        >
                          connect wallet
                        </button>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={openConnectModal}
                        className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 text-[13px] font-bold text-white shadow-[0_0_26px_rgba(34,211,238,0.22)] ring-1 ring-white/70 transition-transform hover:scale-105"
                        style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                      >
                        {shortAddress(connectedAddress ?? account?.address ?? "")}
                      </button>
                    );
                  }}
                </ConnectButton.Custom>
              </div>

              <button
                type="button"
                onClick={closeLeaderboard}
                className="sr-only"
                style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
              >
                Close leaderboard
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
