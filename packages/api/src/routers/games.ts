import { createHash } from "node:crypto";
import { z } from "zod";
import prisma from "@platform/db";

import { publicProcedure, router } from "../index";

const SPEED_O_LIGHT_GAME = "Speed-o-Light";
const ZK_MINES_GAME = "zk Mines";
const SPEED_O_LIGHT_SEQUENCE_LENGTH = 136;
const SPEED_O_LIGHT_XP_PER_HIT = 5;
const ZK_MINES_BOARD_SIZE = 81;
const ZK_MINES_MINE_COUNT = 10;
const ZK_MINES_MINE_VALUE = 9;
const ZK_MINES_SAFE_CELLS = ZK_MINES_BOARD_SIZE - ZK_MINES_MINE_COUNT;

type LeaderboardEntry = {
  rank: number;
  playerAddress: string;
  gameName: string;
  score: number;
  bestSessionId: string;
  updatedAt: string;
  isCurrentPlayer?: boolean;
};

type RecordLeaderboardScoreInput = {
  gameName: string;
  sessionId: string;
  playerAddress: string;
  xp: number;
  isWinner?: boolean;
};

type TapInput = {
  seq_pos?: string;
  grid_index?: string;
  is_danger?: boolean;
  is_tapped?: boolean;
};

type MinesSessionCells = {
  board: number[];
  revealed: number[];
  minePositions: number[];
};

function normalizeAddress(address?: string | null) {
  return address?.trim().toLowerCase() ?? "";
}

function isSameAddress(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);
  return normalizedLeft !== "" && normalizedLeft === normalizedRight;
}

function rankLeaderboardRows(rows: Omit<LeaderboardEntry, "rank" | "isCurrentPlayer">[]): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

function selectLeaderboardWindow(input: {
  rows: LeaderboardEntry[];
  limit: number;
  playerAddress?: string;
  playerWindow: number;
}) {
  const currentPlayerAddress = normalizeAddress(input.playerAddress);
  const rowsWithPlayer = input.rows.map((row) => ({
    ...row,
    isCurrentPlayer: isSameAddress(row.playerAddress, currentPlayerAddress),
  }));

  if (!currentPlayerAddress) {
    return rowsWithPlayer.slice(0, input.limit);
  }

  const currentIndex = rowsWithPlayer.findIndex((row) => row.isCurrentPlayer);
  if (currentIndex === -1 || currentIndex < input.limit) {
    return rowsWithPlayer.slice(0, input.limit);
  }

  const topRows = rowsWithPlayer.slice(0, Math.min(3, input.limit));
  const windowSize = Math.max(3, input.playerWindow);
  const before = Math.floor(windowSize / 2);
  const start = Math.max(topRows.length, currentIndex - before);
  const end = Math.min(rowsWithPlayer.length, start + windowSize);
  const adjustedStart = Math.max(topRows.length, end - windowSize);
  const playerRows = rowsWithPlayer.slice(adjustedStart, end);
  const merged = new Map<number, LeaderboardEntry>();

  for (const row of [...topRows, ...playerRows]) {
    merged.set(row.rank, row);
  }

  return Array.from(merged.values()).sort((left, right) => left.rank - right.rank);
}

async function listLeaderboardFromSessions(): Promise<LeaderboardEntry[]> {
  const rows = await prisma.session_players.findMany({
    where: {
      xp: {
        gt: 0,
      },
      game_sessions: {
        status: "FINISHED",
      },
    },
    orderBy: [{ xp: "desc" }, { updated_at: "desc" }],
    include: {
      game_sessions: {
        select: {
          games: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const bestByPlayerGame = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const gameName = row.game_sessions.games.name;
    const key = `${row.player_address.toLowerCase()}:${gameName}`;
    if (!bestByPlayerGame.has(key)) {
      bestByPlayerGame.set(key, row);
    }
  }

  return rankLeaderboardRows(
    Array.from(bestByPlayerGame.values()).map((row) => ({
      playerAddress: row.player_address,
      gameName: row.game_sessions.games.name,
      score: row.xp,
      bestSessionId: row.session_id,
      updatedAt: row.updated_at.toISOString(),
    })),
  );
}

async function listLeaderboardFromSnapshot(input: { game?: string }): Promise<LeaderboardEntry[]> {
  const rows = await prisma.player_game_leaderboard.findMany({
    where: input.game
      ? {
          games: {
            name: input.game,
          },
        }
      : undefined,
    orderBy: [{ best_session_xp: "desc" }, { updated_at: "desc" }],
    include: {
      games: {
        select: {
          name: true,
        },
      },
    },
  });

  return rankLeaderboardRows(
    rows.map((row) => ({
      playerAddress: row.player_address,
      gameName: row.games.name,
      score: row.best_session_xp,
      bestSessionId: row.best_session_id,
      updatedAt: row.updated_at.toISOString(),
    })),
  );
}

function filterLeaderboardByGame(rows: LeaderboardEntry[], game?: string) {
  if (!game) return rows;
  return rows.filter((row) => row.gameName === game);
}

function generateSpeedGrid() {
  return Array.from({ length: SPEED_O_LIGHT_SEQUENCE_LENGTH }, (_, index) => ({
    index: Math.floor(Math.random() * 25),
    is_danger: index > 0 && index % 17 === 0,
  }));
}

function generateMinesBoard(): MinesSessionCells {
  const minePositions = new Set<number>();
  while (minePositions.size < ZK_MINES_MINE_COUNT) {
    minePositions.add(Math.floor(Math.random() * ZK_MINES_BOARD_SIZE));
  }

  const board = Array.from({ length: ZK_MINES_BOARD_SIZE }, (_, index) => {
    if (minePositions.has(index)) return ZK_MINES_MINE_VALUE;

    const row = Math.floor(index / 9);
    const column = index % 9;
    let adjacentMines = 0;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextColumn = column + columnOffset;
        if (nextRow < 0 || nextRow > 8 || nextColumn < 0 || nextColumn > 8) continue;
        if (minePositions.has(nextRow * 9 + nextColumn)) {
          adjacentMines += 1;
        }
      }
    }

    return adjacentMines;
  });

  return {
    board,
    revealed: [],
    minePositions: Array.from(minePositions.values()),
  };
}

function normalizeMinesCells(value: unknown): MinesSessionCells {
  if (value && typeof value === "object" && "board" in value) {
    const cells = value as MinesSessionCells;
    return {
      board: Array.isArray(cells.board) ? cells.board : [],
      revealed: Array.isArray(cells.revealed) ? cells.revealed : [],
      minePositions: Array.isArray(cells.minePositions) ? cells.minePositions : [],
    };
  }

  if (Array.isArray(value)) {
    return {
      board: value.filter((cell): cell is number => typeof cell === "number"),
      revealed: [],
      minePositions: [],
    };
  }

  return {
    board: [],
    revealed: [],
    minePositions: [],
  };
}

function revealMinesCells(cells: MinesSessionCells, index: number) {
  if (index < 0 || index >= cells.board.length) {
    throw new Error("Cell index out of range");
  }

  const revealed = new Set(cells.revealed);
  revealed.add(index);

  if (cells.board[index] === 0) {
    const queue = [index];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const row = Math.floor(current / 9);
      const column = current % 9;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
          if (rowOffset === 0 && columnOffset === 0) continue;
          const nextRow = row + rowOffset;
          const nextColumn = column + columnOffset;
          if (nextRow < 0 || nextRow > 8 || nextColumn < 0 || nextColumn > 8) continue;
          const nextIndex = nextRow * 9 + nextColumn;
          if (revealed.has(nextIndex) || cells.board[nextIndex] === ZK_MINES_MINE_VALUE) continue;
          revealed.add(nextIndex);
          if (cells.board[nextIndex] === 0) {
            queue.push(nextIndex);
          }
        }
      }
    }
  }

  const nextCells = {
    ...cells,
    revealed: Array.from(revealed.values()).sort((left, right) => left - right),
  };

  return {
    nextCells,
    revealedCells: nextCells.revealed.map((cellIndex) => ({
      index: cellIndex,
      value: nextCells.board[cellIndex] ?? 0,
    })),
  };
}

function minesXpForCells(cells: MinesSessionCells, gameLog?: { index: number; value: number }[]) {
  const entries =
    gameLog && gameLog.length > 0
      ? gameLog
      : cells.revealed.map((index) => ({ index, value: cells.board[index] ?? 0 }));

  return entries.reduce((sum, cell) => {
    if (cell.value === 0) return sum + 10;
    if (cell.value >= 1 && cell.value <= 8) return sum + cell.value;
    return sum;
  }, 0);
}

function bytes32FromUuid(id: string) {
  return `0x${id.replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`;
}

function stableUuidFromParts(...parts: string[]) {
  const hex = createHash("sha256").update(parts.join(":")).digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export async function recordLeaderboardScore(input: RecordLeaderboardScoreInput) {
  const now = new Date();
  const isWinner = input.isWinner ?? false;
  const existingSessionPlayer = await prisma.session_players.findUnique({
    where: {
      session_id_player_address: {
        session_id: input.sessionId,
        player_address: input.playerAddress,
      },
    },
  });
  const xpDelta = input.xp - (existingSessionPlayer?.xp ?? 0);
  const winsDelta = Number(isWinner) - Number(existingSessionPlayer?.is_winner ?? false);

  const game = await prisma.games.upsert({
    where: {
      name: input.gameName,
    },
    update: {
      updated_at: now,
    },
    create: {
      id: crypto.randomUUID(),
      name: input.gameName,
      updated_at: now,
    },
  });

  await prisma.players.upsert({
    where: {
      id: input.playerAddress,
    },
    update: {
      total_xp: xpDelta === 0 ? undefined : { increment: xpDelta },
      wins: winsDelta === 0 ? undefined : { increment: winsDelta },
      updated_at: now,
    },
    create: {
      id: input.playerAddress,
      total_xp: input.xp,
      wins: isWinner ? 1 : 0,
      updated_at: now,
    },
  });

  await prisma.game_sessions.upsert({
    where: {
      id: input.sessionId,
    },
    update: {
      status: "FINISHED",
      updated_at: now,
    },
    create: {
      id: input.sessionId,
      game_id: game.id,
      status: "FINISHED",
      updated_at: now,
    },
  });

  await prisma.session_players.upsert({
    where: {
      session_id_player_address: {
        session_id: input.sessionId,
        player_address: input.playerAddress,
      },
    },
    update: {
      xp: input.xp,
      is_winner: isWinner,
      updated_at: now,
    },
    create: {
      id: crypto.randomUUID(),
      session_id: input.sessionId,
      player_address: input.playerAddress,
      xp: input.xp,
      is_winner: isWinner,
      updated_at: now,
    },
  });

  const bestSession = await prisma.session_players.findFirst({
    where: {
      player_address: input.playerAddress,
      game_sessions: {
        game_id: game.id,
        status: "FINISHED",
      },
    },
    orderBy: [{ xp: "desc" }, { updated_at: "desc" }],
  });

  if (bestSession) {
    await prisma.player_game_leaderboard.upsert({
      where: {
        player_address_game_id: {
          player_address: input.playerAddress,
          game_id: game.id,
        },
      },
      update: {
        best_session_xp: bestSession.xp,
        best_session_id: bestSession.session_id,
        updated_at: now,
      },
      create: {
        id: crypto.randomUUID(),
        player_address: input.playerAddress,
        game_id: game.id,
        best_session_xp: bestSession.xp,
        best_session_id: bestSession.session_id,
        updated_at: now,
      },
    });
  }
}

export const speedOLightProcedures = {
  newGame: publicProcedure
    .input(z.object({ playerAddress: z.string() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const game = await prisma.games.upsert({
        where: {
          name: SPEED_O_LIGHT_GAME,
        },
        update: {
          updated_at: now,
        },
        create: {
          id: crypto.randomUUID(),
          name: SPEED_O_LIGHT_GAME,
          updated_at: now,
        },
      });
      await prisma.players.upsert({
        where: {
          id: input.playerAddress,
        },
        update: {
          updated_at: now,
        },
        create: {
          id: input.playerAddress,
          updated_at: now,
        },
      });

      const sessionId = crypto.randomUUID();
      const gridSequence = generateSpeedGrid();
      await prisma.game_sessions.create({
        data: {
          id: sessionId,
          game_id: game.id,
          status: "IN_PROGRESS",
          updated_at: now,
        },
      });
      await prisma.speed_o_light_sessions.create({
        data: {
          id: crypto.randomUUID(),
          session_id: sessionId,
          seed: crypto.randomUUID(),
          grid_sequence: gridSequence,
          tap_sequence: [],
          updated_at: now,
        },
      });

      return {
        sessionId,
        gridSequence,
      };
    }),
  submitSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        playerAddress: z.string(),
        tapSequence: z.array(
          z.object({
            seq_pos: z.string(),
            grid_index: z.string(),
            is_danger: z.boolean(),
            is_tapped: z.boolean(),
          }),
        ),
        dangerTap: z.object({
          seq_pos: z.string(),
          grid_index: z.string(),
          is_danger: z.boolean(),
          is_tapped: z.boolean(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const safeHits = input.tapSequence.filter((tap: TapInput) => tap.is_tapped && !tap.is_danger).length;
      const dangerHit =
        input.tapSequence.some((tap: TapInput) => tap.is_tapped && tap.is_danger) ||
        (input.dangerTap.is_tapped && input.dangerTap.is_danger);
      const xp = safeHits * SPEED_O_LIGHT_XP_PER_HIT;
      const dangerTapPos = dangerHit ? Number(input.dangerTap.seq_pos) : null;
      const now = new Date();

      await prisma.speed_o_light_sessions.update({
        where: {
          session_id: input.sessionId,
        },
        data: {
          tap_sequence: input.tapSequence,
          danger_tap_pos: Number.isFinite(dangerTapPos) ? dangerTapPos : null,
          score: safeHits,
          updated_at: now,
        },
      });
      await recordLeaderboardScore({
        gameName: SPEED_O_LIGHT_GAME,
        sessionId: input.sessionId,
        playerAddress: input.playerAddress,
        xp,
        isWinner: !dangerHit,
      });

      return {
        sessionId: input.sessionId,
        score: safeHits,
        xp,
        verificationStatus: "FINALIZED",
      };
    }),
  getSessionStatus: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await prisma.speed_o_light_sessions.findUnique({
        where: {
          session_id: input.sessionId,
        },
        include: {
          game_sessions: true,
        },
      });
      if (!session) {
        throw new Error("Session not found");
      }

      return {
        sessionId: input.sessionId,
        status: String(session.game_sessions.status),
        score: session.score,
        xp: session.score * SPEED_O_LIGHT_XP_PER_HIT,
        verificationStatus: session.game_sessions.status === "FINISHED" ? "FINALIZED" : "QUEUED",
      };
    }),
};

export const zkMinesGameRouter = router({
  startGame: publicProcedure
    .input(z.object({ playerAddress: z.string() }))
    .mutation(async ({ input }) => {
      const now = new Date();
      const game = await prisma.games.upsert({
        where: {
          name: ZK_MINES_GAME,
        },
        update: {
          updated_at: now,
        },
        create: {
          id: crypto.randomUUID(),
          name: ZK_MINES_GAME,
          updated_at: now,
        },
      });
      await prisma.players.upsert({
        where: {
          id: input.playerAddress,
        },
        update: {
          updated_at: now,
        },
        create: {
          id: input.playerAddress,
          updated_at: now,
        },
      });

      const gameId = crypto.randomUUID();
      const cells = generateMinesBoard();
      await prisma.game_sessions.create({
        data: {
          id: gameId,
          game_id: game.id,
          status: "IN_PROGRESS",
          updated_at: now,
        },
      });
      await prisma.minesweeper_sessions.create({
        data: {
          id: crypto.randomUUID(),
          session_id: gameId,
          seed: crypto.randomUUID(),
          merkle_root: crypto.randomUUID(),
          cells,
          updated_at: now,
        },
      });
      await prisma.session_players.create({
        data: {
          id: crypto.randomUUID(),
          session_id: gameId,
          player_address: input.playerAddress,
          xp: 0,
          is_winner: false,
          updated_at: now,
        },
      });

      return {
        gameId,
      };
    }),
  revealCell: publicProcedure
    .input(z.object({ gameId: z.string(), index: z.number() }))
    .mutation(async ({ input }) => {
      const session = await prisma.minesweeper_sessions.findUnique({
        where: {
          session_id: input.gameId,
        },
        include: {
          game_sessions: true,
        },
      });
      if (!session) {
        throw new Error("Game not found");
      }
      if (session.game_sessions.status === "FINISHED") {
        const cells = normalizeMinesCells(session.cells);
        return {
          cells: cells.revealed.map((index) => ({ index, value: cells.board[index] ?? 0 })),
          gameOver: true,
          isVictory: !cells.revealed.some((index) => cells.board[index] === ZK_MINES_MINE_VALUE),
        };
      }

      const cells = normalizeMinesCells(session.cells);
      const { nextCells, revealedCells } = revealMinesCells(cells, input.index);
      const hitMine = nextCells.board[input.index] === ZK_MINES_MINE_VALUE;
      const safeRevealed = nextCells.revealed.filter((index) => nextCells.board[index] !== ZK_MINES_MINE_VALUE).length;
      const isVictory = safeRevealed >= ZK_MINES_SAFE_CELLS;
      const gameOver = hitMine || isVictory;

      await prisma.minesweeper_sessions.update({
        where: {
          session_id: input.gameId,
        },
        data: {
          cells: nextCells,
          updated_at: new Date(),
        },
      });

      return {
        cells: gameOver && hitMine
          ? nextCells.minePositions.map((index) => ({ index, value: ZK_MINES_MINE_VALUE }))
          : revealedCells,
        gameOver,
        isVictory,
      };
    }),
  endGame: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
        gameLog: z.array(z.object({ index: z.number(), value: z.number() })),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await prisma.minesweeper_sessions.findUnique({
        where: {
          session_id: input.gameId,
        },
        include: {
          game_sessions: {
            include: {
              session_players: true,
            },
          },
        },
      });
      if (!session) {
        throw new Error("Game not found");
      }

      const cells = normalizeMinesCells(session.cells);
      const hitMine = input.gameLog.some((cell) => cell.value === ZK_MINES_MINE_VALUE);
      const safeRevealed = input.gameLog.filter((cell) => cell.value !== ZK_MINES_MINE_VALUE).length;
      const isVictory = !hitMine && safeRevealed >= ZK_MINES_SAFE_CELLS;
      const xp = minesXpForCells(cells, input.gameLog);
      const playerAddress = session.game_sessions.session_players[0]?.player_address;

      await prisma.game_sessions.update({
        where: {
          id: input.gameId,
        },
        data: {
          status: "FINISHED",
          updated_at: new Date(),
        },
      });

      if (playerAddress) {
        await recordLeaderboardScore({
          gameName: ZK_MINES_GAME,
          sessionId: input.gameId,
          playerAddress,
          xp,
          isWinner: isVictory,
        });
      }

      return {
        xp,
        proofStatus: "FINALIZED",
        isVictory,
      };
    }),
  getGame: publicProcedure.input(z.object({ gameId: z.string() })).query(async ({ input }) => {
    const session = await prisma.minesweeper_sessions.findUnique({
      where: {
        session_id: input.gameId,
      },
      include: {
        game_sessions: {
          include: {
            session_players: true,
          },
        },
      },
    });
    if (!session) {
      throw new Error("Game not found");
    }
    const cells = normalizeMinesCells(session.cells);
    const player = session.game_sessions.session_players[0];
    const hitMine = cells.revealed.some((index) => cells.board[index] === ZK_MINES_MINE_VALUE);
    const safeRevealed = cells.revealed.filter((index) => cells.board[index] !== ZK_MINES_MINE_VALUE).length;

      return {
        gameId: input.gameId,
      status: String(session.game_sessions.status),
      proofStatus: session.game_sessions.status === "FINISHED" ? "FINALIZED" : "QUEUED",
      xp: player?.xp ?? minesXpForCells(cells),
      isVictory: !hitMine && safeRevealed >= ZK_MINES_SAFE_CELLS,
    };
  }),
  getOnchainPayload: publicProcedure
    .input(z.object({ gameId: z.string(), playerAddress: z.string().optional() }))
    .mutation(async ({ input }) => {
      const sessionPlayer = await prisma.session_players.findFirst({
        where: {
          session_id: input.gameId,
        },
      });

      return {
        gameId: bytes32FromUuid(input.gameId),
        xpEarned: sessionPlayer?.xp ?? 0,
        won: sessionPlayer?.is_winner ?? false,
        signature: `0x${"00".repeat(65)}`,
      };
    }),
});

export const leaderboardRouter = router({
  record: publicProcedure
    .input(
      z.object({
        gameName: z.string().min(1),
        sessionKey: z.string().min(1),
        playerAddress: z.string().min(1),
        score: z.number().int().min(0),
        isWinner: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sessionId = stableUuidFromParts("leaderboard", input.gameName, input.sessionKey, input.playerAddress);
      await recordLeaderboardScore({
        gameName: input.gameName,
        sessionId,
        playerAddress: input.playerAddress,
        xp: input.score,
        isWinner: input.isWinner,
      });

      return {
        ok: true,
        sessionId,
      };
    }),
  list: publicProcedure
    .input(
      z
        .object({
          game: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(10),
          playerAddress: z.string().optional(),
          playerWindow: z.number().int().min(3).max(20).default(5),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const normalizedInput = {
        game: input?.game,
        limit: input?.limit ?? 10,
        playerAddress: input?.playerAddress,
        playerWindow: input?.playerWindow ?? 5,
      };
      const sessionRows = filterLeaderboardByGame(await listLeaderboardFromSessions(), normalizedInput.game);
      if (sessionRows.length > 0) {
        return selectLeaderboardWindow({
          rows: sessionRows,
          limit: normalizedInput.limit,
          playerAddress: normalizedInput.playerAddress,
          playerWindow: normalizedInput.playerWindow,
        });
      }

      return selectLeaderboardWindow({
        rows: await listLeaderboardFromSnapshot(normalizedInput),
        limit: normalizedInput.limit,
        playerAddress: normalizedInput.playerAddress,
        playerWindow: normalizedInput.playerWindow,
      });
    }),
});
