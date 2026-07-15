import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ArrowUpRight, ChevronDown, LogOut, Trophy } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const GAMES = [
  {
    id: "card-wars",
    name: "Card-Wars",
    title: "CARD-WARS",
    to: "/game/card-wars",
    image: "/card-wars.png",
    imageClassName: "object-[50%_42%]",
  },
  {
    id: "speed-o-light",
    name: "Speed-o-Light",
    title: "SPEED - O - LIGHT",
    to: "/game/speed-o-light",
    image: "/speed-o-light.png",
    imageClassName: "object-center",
  },
  {
    id: "zk-mines",
    name: "zk Mines",
    title: "ZK MINES",
    to: "/game/zk-mines",
    image: "/zkMines.png",
    imageClassName: "object-[50%_40%]",
  },
] as const;

const GAME_FILTERS = ["All Games", ...GAMES.map((game) => game.name)] as const;
type GameFilter = (typeof GAME_FILTERS)[number];

const displayFont = { fontFamily: "Rajdhani, Inter, sans-serif" };
const medalAssets = {
  gold: "https://www.figma.com/api/mcp/asset/3bd3ad8e-1256-4fbd-a76e-4c3cf51c66b0",
  silver: "https://www.figma.com/api/mcp/asset/c9836206-cdf7-4649-ade5-b72b0ecdc387",
  bronze: "https://www.figma.com/api/mcp/asset/24c29318-9f17-44a4-9f00-60cced720116",
} as const;

type LeaderboardEntry = {
  rank: number;
  medal?: keyof typeof medalAssets;
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

function BackgroundLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.22)_45%,rgba(4,10,37,0.84)_100%),linear-gradient(180deg,#0f299e_6.6%,#040a25_69.1%)]" />
      <img
        src="/bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-85 mix-blend-screen sm:object-[50%_48%]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,255,255,0.10),transparent_10%),radial-gradient(ellipse_at_82%_58%,rgba(196,74,62,0.18),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.42)_0%,rgba(0,0,0,0)_40%,rgba(0,0,0,0.36)_100%)]" />
    </div>
  );
}

function WalletButton({ className = "" }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal }) => {
        const walletAddress = address ?? account?.address ?? "";
        const label = walletAddress ? shortAddress(walletAddress) : "connect wallet";
        const hasWallet = isConnected || Boolean(account);

        if (hasWallet) {
          return (
            <div
              className={[
                "inline-flex items-center overflow-hidden rounded-full border border-white/90 bg-[radial-gradient(circle_at_22%_0%,#18b9a9_0%,#26738f_52%,#383184_100%)] text-center font-medium text-white shadow-[0_0_22px_rgba(34,211,238,0.28)] transition-transform hover:scale-105 disabled:opacity-50",
                className,
                "px-0!",
              ].join(" ")}
              style={displayFont}
            >
              <button
                type="button"
                onClick={openConnectModal}
                disabled={!mounted}
                className="flex h-full min-w-0 items-center justify-center px-6 disabled:opacity-50"
              >
                {label}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  disconnect();
                }}
                disabled={!mounted}
                aria-label="Disconnect wallet"
                className="grid h-full w-[52px] shrink-0 place-items-center border-l border-white/90 bg-white/5 disabled:opacity-50"
              >
                <LogOut className="size-6" strokeWidth={2.2} />
              </button>
            </div>
          );
        }

        return (
          <button
            type="button"
            onClick={openConnectModal}
            disabled={!mounted}
            className={[
              "rounded-full border border-white/90 bg-[radial-gradient(circle_at_22%_0%,#07f49e_0%,#257c8e_46%,#42047e_100%)] text-center font-medium text-white shadow-[0_0_22px_rgba(34,211,238,0.28)] transition-transform hover:scale-105 disabled:opacity-50",
              className,
            ].join(" ")}
            style={displayFont}
          >
            connect wallet
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <div className={["flex items-center gap-2 text-[#99ffa5]", className].join(" ")}>
      <span className="grid size-[11.5px] place-items-center rounded-full border border-[#99ffa5]/80 bg-[#99ffa5]/30">
        <span className="size-[5.5px] rounded-full bg-[#99ffa5]" />
      </span>
      <span className="text-xs font-medium lowercase" style={{ fontFamily: "Inter, sans-serif" }}>
        verified on
      </span>
      <span className="grid size-[19px] place-items-center rounded-[5px] bg-[#99ffa5] text-[10px] font-black leading-none text-[#041127]">
        ZK
      </span>
    </div>
  );
}

function MobileTabs({ openLeaderboard }: { openLeaderboard: () => void }) {
  return (
    <div className="flex items-center justify-center rounded-[28px] text-sm" style={displayFont}>
      <span className="rounded-[24px] bg-white px-5 py-2.5 font-semibold text-[#050f38]">Games</span>
      <button type="button" onClick={openLeaderboard} className="px-5 py-2.5 text-white">
        Leaderboard
      </button>
    </div>
  );
}

function PlayPill() {
  return (
    <span
      className="inline-flex h-[25.64px] items-center overflow-hidden rounded-full text-[10px] text-white shadow-[0_0_18px_rgba(255,98,24,0.25)]"
      style={displayFont}
    >
      <span className="flex h-full items-center rounded-l-full rounded-r-[2px] border border-[#dcc7c7] bg-[radial-gradient(circle_at_82%_210%,#e60b09_0%,#e86e16_50%,#e9d022_100%)] px-[10px]">
        PLAY NOW
      </span>
      <span className="ml-[0.48px] grid h-full w-[25px] place-items-center rounded-l-[2px] rounded-r-full border border-[#dcc7c7] bg-[radial-gradient(circle_at_82%_210%,#e60b09_0%,#e86e16_50%,#e9d022_100%)]">
        <ArrowUpRight className="size-3.5" strokeWidth={2.2} />
      </span>
    </span>
  );
}

function GameCard({ game }: { game: (typeof GAMES)[number] }) {
  return (
    <Link
      to={game.to}
      className="group relative h-64 w-full overflow-hidden rounded-[6px] bg-[#120d1c] shadow-[0_24px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/5 transition-transform duration-300 hover:-translate-y-1 sm:h-[307px] sm:max-w-[400px]"
    >
      <img
        src={game.image}
        alt={game.name}
        className={[
          "absolute inset-0 h-full w-full scale-105 object-cover brightness-[0.78] saturate-[0.98] blur-[1.5px] transition-transform duration-500 group-hover:scale-110",
          game.imageClassName,
        ].join(" ")}
      />
      <div className="absolute inset-0 bg-[linear-gradient(171deg,rgba(102,102,102,0)_11.52%,rgba(49,49,49,0.50)_47.04%,#000_100.21%)]" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-4 px-7 pb-5 sm:px-12 sm:pb-8">
        <div className="flex flex-col items-end gap-2">
          <h2
            className="max-w-[280px] text-right text-[28px] font-bold leading-none text-white uppercase drop-shadow-[0_2px_18px_rgba(0,0,0,0.75)] sm:text-[32px]"
            style={displayFont}
          >
            {game.title}
          </h2>
          <PlayPill />
        </div>
      </div>
    </Link>
  );
}

function PodiumMedal({ rank, medal }: { rank: number; medal: keyof typeof medalAssets }) {
  return (
    <span className="grid size-8 place-items-center" aria-label={`Rank ${rank}`}>
      <img src={medalAssets[medal]} alt="" className="size-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.12)]" />
    </span>
  );
}

function getFilterLabel(filter: GameFilter) {
  if (filter === "Speed-o-Light") return "Speed - O - Light";
  if (filter === "zk Mines") return "ZK Mines";
  return filter;
}

function GameSelector({
  selectedGame,
  onChange,
  onOpenChange,
}: {
  selectedGame: GameFilter;
  onChange: (game: GameFilter) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const setMenuOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
  };

  return (
    <div className="relative z-30 w-[220px] sm:w-[160px]" style={displayFont}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setMenuOpen(!open)}
        className="flex h-[62px] w-full items-center justify-between rounded-full bg-[rgba(84,58,118,0.92)] pl-9 pr-6 text-[20px] font-bold text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-[1px] transition-colors hover:bg-[#654386] sm:h-11 sm:pl-[22px] sm:pr-3 sm:text-sm"
      >
        <span className="flex-1 text-center">{getFilterLabel(selectedGame)}</span>
        <ChevronDown className={["size-8 text-[#b584ff] transition-transform sm:size-5", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {open ? (
        <div className="absolute left-1/2 top-[calc(100%+26px)] w-[450px] -translate-x-1/2 rounded-[54px] border-2 border-[#8c3ff3] bg-[rgba(84,58,118,0.96)] p-5 shadow-[0_0_0_1px_rgba(177,113,255,0.22),0_18px_44px_rgba(0,0,0,0.34)] backdrop-blur-md sm:left-0 sm:right-auto sm:top-[calc(100%+10px)] sm:w-full sm:translate-x-0 sm:rounded-[24px] sm:p-2">
          <div role="listbox" aria-label="Filter leaderboard by game" className="space-y-5 sm:space-y-1.5">
            {GAME_FILTERS.map((game) => {
              const active = game === selectedGame;
              return (
                <button
                  key={game}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(game);
                    setMenuOpen(false);
                  }}
                  className={[
                    "h-[72px] w-full rounded-full text-center text-[36px] font-bold text-white transition-colors sm:h-9 sm:text-base",
                    active ? "bg-[#ad7bef]" : "hover:bg-white/10",
                  ].join(" ")}
                >
                  {getFilterLabel(game)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HomePage() {
  const { address, isConnected } = useAccount();
  const [selectedGame, setSelectedGame] = useState<GameFilter>("All Games");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
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

  const openLeaderboard = () => {
    window.history.replaceState(null, "", "/#leaderboard");
    setLeaderboardOpen(true);
  };

  const handleGameChange = (game: GameFilter) => {
    setSelectedGame(game);
    setGameSelectorOpen(false);
    window.history.replaceState(null, "", "/#leaderboard");
    setLeaderboardOpen(true);
  };

  useEffect(() => {
    const openFromEvent = () => setLeaderboardOpen(true);
    const openFromHash = () => {
      if (window.location.hash === "#leaderboard") {
        setLeaderboardOpen(true);
      }
    };

    openFromHash();
    window.addEventListener("open-leaderboard", openFromEvent);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.removeEventListener("open-leaderboard", openFromEvent);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  useEffect(() => {
    if (!leaderboardOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLeaderboardOpen(false);
        setGameSelectorOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leaderboardOpen]);

  const closeLeaderboard = () => {
    setLeaderboardOpen(false);
    setGameSelectorOpen(false);
    if (window.location.hash === "#leaderboard") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-[#040a25] text-white">
      <BackgroundLayer />

      <main className="relative z-10 mx-auto flex min-h-svh w-full max-w-[1280px] flex-col items-center px-6 pb-[52px] pt-[65px] sm:px-6 sm:pb-9 sm:pt-[104px]">
        <section id="about" className="flex w-full flex-col items-center">
          <VerifiedBadge className="sm:hidden" />

          <img
            src="/khel-logo.png"
            alt="Khel.fun"
            className="mt-14 h-auto w-[281px] drop-shadow-[0_0_30px_rgba(255,120,44,0.28)] sm:mt-0 sm:w-[557px]"
          />

          <MobileTabs openLeaderboard={openLeaderboard} />

          <div
            id="games"
            className="mt-[42px] grid w-full max-w-[1224px] grid-cols-1 justify-items-center gap-2 sm:mt-11 sm:grid-cols-3"
          >
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-linear-to-t from-[#050f38] via-[#050f38]/70 to-transparent pb-8 pt-24 sm:hidden">
          <WalletButton className="pointer-events-auto h-[47px] px-7 text-lg" />
        </div>
      </main>

      {leaderboardOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-0 py-0 backdrop-blur-[1px] sm:px-6 sm:py-[5vh]"
          onClick={closeLeaderboard}
          role="presentation"
        >
          <section
            id="leaderboard"
            className="relative flex min-h-svh w-full flex-col overflow-hidden bg-[rgba(22,9,20,0.76)] px-6 pb-8 pt-7 shadow-[0_40px_120px_rgba(0,0,0,0.62)] ring-1 ring-white/5 backdrop-blur-[28px] sm:min-h-[730px] sm:max-w-[571px] sm:rounded-[48px] sm:px-14 sm:py-16"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leaderboard-title"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_30%,rgba(126,82,77,0.18),transparent_28%),radial-gradient(circle_at_52%_78%,rgba(93,31,57,0.22),transparent_40%),linear-gradient(180deg,rgba(7,10,42,0.18)_0%,rgba(12,2,15,0.28)_100%)]" />

            <div className="relative z-10 flex min-h-[calc(100svh-60px)] flex-col sm:min-h-[524px]">
              <div className="mb-12 flex items-center justify-between sm:hidden">
                <img src="/khel-logo.png" alt="Khel.fun" className="h-24 w-auto object-contain" />
                <div className="scale-[0.86]">
                  <MobileTabs openLeaderboard={() => undefined} />
                </div>
              </div>

              <div className="flex items-center justify-center gap-5 sm:justify-between">
                <h1
                  id="leaderboard-title"
                  className="hidden text-[32px] font-bold leading-none tracking-[-0.03em] text-white sm:block"
                  style={displayFont}
                >
                  LEADERBOARD
                </h1>
                <GameSelector selectedGame={selectedGame} onChange={handleGameChange} onOpenChange={setGameSelectorOpen} />
              </div>

              <div
                className={[
                  "mx-auto w-full max-w-[444px] space-y-2 transition-[margin] duration-200",
                  gameSelectorOpen ? "mt-[500px] sm:mt-[220px]" : "mt-7 sm:mt-20",
                ].join(" ")}
              >
                {leaderboardQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="grid h-[60px] animate-pulse grid-cols-[56px_1fr_64px] items-center rounded-[6px] bg-white/8 px-3"
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
                  <div className="space-y-11">
                    <div className="space-y-2">
                      {leaderboard.slice(0, 3).map((entry) => {
                        const isCurrentPlayer = Boolean(entry.isCurrentPlayer);

                        return (
                          <div
                            key={`${entry.rank}-${entry.playerAddress}-${entry.gameName}`}
                            className={[
                              "relative grid min-h-[60px] grid-cols-[72px_1fr_64px] items-center rounded-[6px] bg-[rgba(201,171,241,0.20)] px-3 text-base text-[#ece9f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[32px]",
                              isCurrentPlayer
                                ? "border border-[#d8db30] bg-[rgba(201,171,241,0.24)] text-white shadow-[0_0_0_1px_rgba(236,72,153,0.60),0_0_22px_rgba(217,70,239,0.22)]"
                                : "",
                            ].join(" ")}
                            style={displayFont}
                          >
                            {isCurrentPlayer ? (
                              <>
                                <img
                                  src="/leaderboard/party-popper.png"
                                  alt=""
                                  aria-hidden="true"
                                  className="absolute -left-4 top-1/2 size-8 translate-y-[-42%] rotate-[-10deg] object-contain drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]"
                                />
                                <img
                                  src="/leaderboard/star-struck.png"
                                  alt=""
                                  aria-hidden="true"
                                  className="absolute -right-4 -top-3 size-9 rotate-6 object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                                />
                              </>
                            ) : null}
                            <div className="flex items-center justify-center">
                              {entry.medal ? (
                                <PodiumMedal rank={entry.rank} medal={entry.medal} />
                              ) : (
                                <span className="text-sm font-bold">#{String(entry.rank).padStart(2, "0")}</span>
                              )}
                            </div>
                            <div className="min-w-0 truncate font-bold text-white">{shortAddress(entry.playerAddress)}</div>
                            <span className="text-center font-bold tabular-nums text-white">{entry.score.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>

                    {leaderboard.length > 3
                      ? (() => {
                        const lowerEntries = leaderboard.slice(3, 8);
                        const currentLowerIndex = lowerEntries.findIndex((entry) => entry.isCurrentPlayer);
                        const isPlayerWindow = currentLowerIndex >= 0 && (lowerEntries[0]?.rank ?? 4) > 4;

                        return (
                          <div className="space-y-1">
                            {lowerEntries.map((entry, index) => {
                          const isCurrentPlayer = Boolean(entry.isCurrentPlayer) && index === currentLowerIndex;
                          const distanceFromCurrent =
                            isPlayerWindow ? Math.abs(index - currentLowerIndex) : undefined;
                          const opacity =
                            isPlayerWindow && !isCurrentPlayer
                              ? distanceFromCurrent === 1
                                ? "text-white/45"
                                : "text-white/24"
                              : (["text-white/82", "text-white/72", "text-white/62", "text-white/52", "text-white/42"][index] ?? "text-white/45");

                          return (
                            <div
                              key={`${entry.rank}-${entry.playerAddress}-${entry.gameName}`}
                              className={[
                                "relative grid min-h-[40px] grid-cols-[72px_1fr_64px] items-center px-3 text-sm",
                                opacity,
                                isCurrentPlayer ? "border-y border-white/16 bg-transparent text-white shadow-none" : "",
                              ].join(" ")}
                              style={displayFont}
                            >
                              <span className={["text-center", isCurrentPlayer ? "font-bold" : "font-medium"].join(" ")}>
                                #{String(entry.rank).padStart(2, "0")}
                              </span>
                              <span className={["min-w-0 truncate", isCurrentPlayer ? "font-bold" : "font-medium"].join(" ")}>
                                {shortAddress(entry.playerAddress)}
                              </span>
                              <span className={["text-center tabular-nums", isCurrentPlayer ? "font-bold" : "font-semibold"].join(" ")}>
                                {entry.score.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                          </div>
                        );
                      })()
                      : null}
                  </div>
                )}
              </div>

              <div className={["mt-auto justify-center", leaderboard.length > 0 ? "hidden pt-0 sm:hidden" : "flex pt-8"].join(" ")}>
                <WalletButton className="px-6 py-3 text-[13px]" />
              </div>

              <button type="button" onClick={closeLeaderboard} className="sr-only" style={displayFont}>
                Close leaderboard
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
