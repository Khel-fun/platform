import { useState, useCallback, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { trpc, trpcClient, type AppRouter } from "../utils/trpc";

type GameOut = inferRouterOutputs<AppRouter>["game"];
import GameBoard from "../components/game-board";
import GameStatus from "../components/game-status";
import ProofStatusBar, { getProofUiVariant } from "../components/proof-status-bar";
import PublishOnchain from "../components/publish-onchain";
import { Button } from "@minesweeper/ui/components/button";
import type { Route } from "./+types/_index";
import { soundEffects } from "../utils/sound";

const MINE_VALUE = 9;
const SAFE_CELLS = 71;

interface GameLogEntry {
  index: number;
  value: number;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "zkMines: Verifiable Minesweeper" },
    {
      name: "description",
      content: "A cryptographically verifiable zkMines game powered by Zero-Knowledge proofs",
    },
  ];
}

export default function Home() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const primaryConnector = useMemo(
    () => connectors.find((c) => c.ready) ?? connectors[0],
    [connectors],
  );

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  const openDisconnectModal = useCallback(() => {
    setDisconnectModalOpen(true);
  }, []);
  const [publishedOnchain, setPublishedOnchain] = useState(false);

  const [gameId, setGameId] = useState<string | null>(null);
  const [revealedCells, setRevealedCells] = useState<Map<number, number>>(new Map());
  const [flaggedCells, setFlaggedCells] = useState<Set<number>>(new Set());
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "won" | "lost">("idle");
  const [xp, setXp] = useState<number | null>(null);
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [isVictoryFinal, setIsVictoryFinal] = useState(false);

  useEffect(() => {
    if (isConnected) return;
    setDisconnectModalOpen(false);
    setGameId(null);
    setRevealedCells(new Map());
    setFlaggedCells(new Set());
    setGameLog([]);
    setGameStatus("idle");
    setXp(null);
    setMinePositions([]);
    setProofStatus(null);
    setIsVictoryFinal(false);
    setPublishedOnchain(false);
  }, [isConnected]);

  const startGameMutation = useMutation({
    mutationFn: () => {
      if (!address) {
        throw new Error("Connect a wallet to start a game");
      }
      return trpcClient.game.startGame.mutate({ playerAddress: address });
    },
    onSuccess: (data: GameOut["startGame"]) => {
      setGameId(data.gameId);
      setRevealedCells(new Map());
      setFlaggedCells(new Set());
      setGameLog([]);
      setGameStatus("playing");
      setXp(null);
      setMinePositions([]);
      setProofStatus(null);
      setIsVictoryFinal(false);
      setPublishedOnchain(false);
    },
  });

  const revealCellMutation = useMutation({
    mutationFn: (input: { gameId: string; index: number }) =>
      trpcClient.game.revealCell.mutate(input),
    onSuccess: (data: GameOut["revealCell"]) => {
      setRevealedCells((prev) => {
        const next = new Map(prev);
        for (const cell of data.cells) {
          next.set(cell.index, cell.value);
        }
        return next;
      });

      setGameLog((prev) => {
        const existing = new Set(prev.map((e) => e.index));
        const newEntries = data.cells.filter((c: { index: number }) => !existing.has(c.index));
        return [...prev, ...newEntries];
      });

      if (data.gameOver) {
        if (data.isVictory) {
          setGameStatus("won");
          soundEffects.win();
        } else {
          setGameStatus("lost");
          soundEffects.lose();
          setMinePositions(
            data.cells
              .filter((c: { value: number }) => c.value === MINE_VALUE)
              .map((c: { index: number }) => c.index),
          );
        }
      } else {
        soundEffects.reveal();
      }
    },
  });

  const endGameMutation = useMutation({
    mutationFn: (input: { gameId: string; gameLog: GameLogEntry[] }) =>
      trpcClient.game.endGame.mutate(input),
    onSuccess: (data: GameOut["endGame"]) => {
      setXp(data.xp);
      setProofStatus(data.proofStatus);
      setIsVictoryFinal(data.isVictory);
    },
  });

  const runningXP = Array.from(revealedCells.values()).reduce((sum, value) => {
    if (value === 0) return sum + 10;
    if (value >= 1 && value <= 8) return sum + value;
    return sum;
  }, 0);
  const effectiveXp = xp ?? runningXP;

  useEffect(() => {
    const safeRevealed = Array.from(revealedCells.values()).filter((v) => v !== MINE_VALUE).length;
    if (gameStatus === "playing" && safeRevealed >= SAFE_CELLS) {
      setGameStatus("won");
    }
  }, [revealedCells, gameStatus]);

  useEffect(() => {
    if ((gameStatus === "won" || gameStatus === "lost") && gameId && gameLog.length > 0) {
      endGameMutation.mutate({ gameId, gameLog });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]);

  const PROOF_TERMINAL = ["INCLUDED_IN_BLOCK", "FINALIZED", "AGGREGATED", "FAILED"];
  const isProofDone = proofStatus !== null && PROOF_TERMINAL.includes(proofStatus);

  const gameQuery = useQuery({
    ...trpc.game.getGame.queryOptions({ gameId: gameId ?? "" }),
    enabled: !!gameId && (gameStatus === "won" || gameStatus === "lost") && !isProofDone,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const row = gameQuery.data as GameOut["getGame"] | undefined;
    if (!row) return;
    if (row.proofStatus && row.proofStatus !== proofStatus) {
      setProofStatus(row.proofStatus);
    }
    // SessionPlayer.xp stays 0 until resolveSession (endGame). Syncing from getGame
    // while status is not FINISHED would flash "0 XP" and block runningXP via ??.
    if (
      (gameStatus === "won" || gameStatus === "lost") &&
      row.status === "FINISHED" &&
      typeof row.xp === "number"
    ) {
      setXp(row.xp);
    }
    if ((gameStatus === "won" || gameStatus === "lost") && typeof row.isVictory === "boolean") {
      setIsVictoryFinal(row.isVictory);
    }
  }, [gameQuery.data, proofStatus, gameStatus]);

  const handleCellClick = useCallback(
    (index: number) => {
      if (!isConnected || !gameId || gameStatus !== "playing") return;
      soundEffects.click();
      revealCellMutation.mutate({ gameId, index });
    },
    [isConnected, gameId, gameStatus, revealCellMutation],
  );

  const handleCellRightClick = useCallback((index: number) => {
    if (!isConnected) return;
    soundEffects.flag();
    setFlaggedCells((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [isConnected]);

  const handleNewGame = useCallback(() => {
    soundEffects.click();
    startGameMutation.mutate();
  }, [startGameMutation]);

  const handlePublishConfirmed = useCallback(() => {
    setPublishedOnchain(true);
  }, []);

  const isStartingGame = startGameMutation.isPending;
  const boardSessionActive = Boolean(gameId) || isStartingGame;
  const gameOver = gameStatus === "won" || gameStatus === "lost";
  const proofVariant = getProofUiVariant(proofStatus);
  const proofUiPending = gameOver && proofVariant === "pending";
  const proofUiVerified = gameOver && proofVariant === "verified";
  /** Publish after proof UI is verified (includes INCLUDED_IN_BLOCK; matches server getOnchainPayload). */
  const showPublishOnchain = Boolean(gameId) && proofUiVerified;
  const showLobbyActions =
    isConnected &&
    ((!gameId && !isStartingGame) ||
      (gameOver && !isStartingGame && !proofUiPending));

  return (
    <div
      className={`game-page${proofUiPending && isConnected ? " game-page--proof-pending" : ""}${proofUiVerified && isConnected ? " game-page--publish-ready" : ""}${publishedOnchain && isConnected ? " game-page--published" : ""}`}
    >
      <div className="game-container">
        <div className="game-header">
          <h1 className="game-title" id="game-title">
            <span className="title-icon" aria-hidden>
              💣
            </span>
            <span className="title-wordmark">
              zkMines
              <span className="title-badge">ZK</span>
            </span>
          </h1>
          <p className="game-subtitle">Cryptographically Verifiable Fairness</p>
        </div>

        <div
          className={`game-controls ${isConnected ? "game-controls--connected" : "game-controls--disconnected"}${isConnected && address && !showLobbyActions ? " game-controls--in-session" : ""}`}
        >
          {!isConnected && primaryConnector ? (
            <Button
              type="button"
              onClick={() => connect({ connector: primaryConnector })}
              disabled={connectPending}
              className="connect-wallet-btn-main"
            >
              {connectPending ? "Connecting…" : "Connect Wallet"}
            </Button>
          ) : null}
          {!isConnected && !primaryConnector ? (
            <p className="text-sm text-[#808080] text-center px-2">No wallet extension detected.</p>
          ) : null}
          {isConnected && address ? (
            <div
              className={`wallet-row ${showLobbyActions ? "wallet-row--stack" : "wallet-row--session-only"}`}
            >
              <button
                type="button"
                className={`wallet-pill wallet-pill--display${boardSessionActive ? " wallet-pill--session" : ""}`}
                title={`${address} — click to disconnect`}
                onClick={openDisconnectModal}
              >
                <span className="wallet-pill-address">
                  {address.slice(0, 6)}..{address.slice(-4)}
                </span>
              </button>
              {showLobbyActions ? (
                <Button
                  id="new-game-btn"
                  onClick={handleNewGame}
                  disabled={startGameMutation.isPending || !isConnected || !address}
                  className="new-game-btn"
                >
                  {startGameMutation.isPending ? "Creating Board..." : "New Game"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className={`board-stage${boardSessionActive && isConnected && !proofUiVerified ? " board-stage--with-pills" : ""}`}
        >
          <GameStatus
            xp={effectiveXp}
            revealedCount={Array.from(revealedCells.values()).filter((v) => v !== MINE_VALUE).length}
            connected={isConnected && boardSessionActive && !proofUiVerified}
          />

          <GameBoard
            gameId={gameId}
            revealedCells={revealedCells}
            flaggedCells={flaggedCells}
            gameOver={gameOver}
            isVictory={gameStatus === "won"}
            onCellClick={handleCellClick}
            onCellRightClick={handleCellRightClick}
            minePositions={minePositions}
            isConnected={isConnected}
            isBoardLoading={isStartingGame}
          />

          <ProofStatusBar
            visible={isConnected && gameOver && !proofUiVerified}
            proofStatus={proofStatus}
          />
        </div>

        {showPublishOnchain && gameId ? (
          <PublishOnchain
            gameId={gameId}
            xp={effectiveXp}
            isVictory={isVictoryFinal}
            onPublishConfirmed={handlePublishConfirmed}
          />
        ) : null}

        {!proofUiPending && !proofUiVerified ? (
          <div className="game-footer">
            <p>9×9 Grid • 10 Mines • ZK Proven Fair Play</p>
          </div>
        ) : null}
      </div>

      {disconnectModalOpen ? (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setDisconnectModalOpen(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="disconnect-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title" id="disconnect-modal-title">
              Proceed to disconnect wallet?
            </h2>
            <p className="modal-body">
              Caution: you may lose your game progress if you disconnect.
            </p>
            <div className="modal-actions modal-actions--spread">
              <button type="button" className="modal-cancel" onClick={() => setDisconnectModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="modal-disconnect-confirm"
                onClick={() => {
                  setDisconnectModalOpen(false);
                  if (connector) disconnect({ connector });
                  else disconnect();
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
