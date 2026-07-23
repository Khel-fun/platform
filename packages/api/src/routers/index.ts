import { publicProcedure, router } from "../index";
import { leaderboardRouter, speedOLightProcedures, zkMinesGameRouter } from "./games";

const healthCheck = publicProcedure.query(() => {
  return "OK";
});

export const speedOLightRouter = router(speedOLightProcedures);
export const speedOLightBackendRouter = router(speedOLightProcedures);

export const speedOLightAppRouter = router({
  healthCheck,
  speedOLight: speedOLightRouter,
});

export const zkMinesAppRouter = router({
  healthCheck,
  game: zkMinesGameRouter,
});

export const appRouter = router({
  healthCheck,
  speedOLight: speedOLightRouter,
  leaderboard: leaderboardRouter,
  game: zkMinesGameRouter,
});
export type AppRouter = typeof appRouter;
export type SpeedOLightAppRouter = typeof speedOLightAppRouter;
export type SpeedOLightBackendRouter = typeof speedOLightBackendRouter;
export type ZkMinesAppRouter = typeof zkMinesAppRouter;
