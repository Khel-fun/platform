import { publicProcedure, router } from "../index";
import { cardWarsRouter } from "./card-wars";
import { leaderboardRouter, speedOLightProcedures, zkMinesGameRouter } from "./games";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  ...speedOLightProcedures,
  cardWars: cardWarsRouter,
  leaderboard: leaderboardRouter,
  game: zkMinesGameRouter,
});
export type AppRouter = typeof appRouter;
