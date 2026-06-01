import { z } from "zod";
import { publicProcedure, router } from "../index";

const notConfigured = (game: string) => {
  throw new Error(`${game} backend not configured yet`);
};

export const speedOLightProcedures = {
  newGame: publicProcedure
    .input(z.object({ playerAddress: z.string() }))
    .mutation(async () => notConfigured("Speed-o-Light")),
  submitSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        playerAddress: z.string(),
        tapSequence: z.array(z.record(z.string(), z.unknown())),
        dangerTap: z.record(z.string(), z.unknown()),
      }),
    )
    .mutation(async () => notConfigured("Speed-o-Light")),
  getSessionStatus: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async () => notConfigured("Speed-o-Light")),
};

export const zkMinesGameRouter = router({
  startGame: publicProcedure
    .input(z.object({ playerAddress: z.string() }))
    .mutation(async () => notConfigured("zkMines")),
  revealCell: publicProcedure
    .input(z.object({ gameId: z.string(), index: z.number() }))
    .mutation(async () => notConfigured("zkMines")),
  endGame: publicProcedure
    .input(
      z.object({
        gameId: z.string(),
        gameLog: z.array(z.object({ index: z.number(), value: z.number() })),
      }),
    )
    .mutation(async () => notConfigured("zkMines")),
  getGame: publicProcedure.input(z.object({ gameId: z.string() })).query(async () => notConfigured("zkMines")),
  getOnchainPayload: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async () => notConfigured("zkMines")),
});
