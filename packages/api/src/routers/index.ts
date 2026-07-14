import { publicProcedure, router } from "../index";
import { leaderboardRouter, speedOLightProcedures, zkMinesGameRouter } from "./games";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  ...speedOLightProcedures,
  leaderboard: leaderboardRouter,
  game: zkMinesGameRouter,
});
export type AppRouter = typeof appRouter;
