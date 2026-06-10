import { publicProcedure, router } from "../index";
import { speedOLightProcedures, zkMinesGameRouter } from "./games";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  ...speedOLightProcedures,
  game: zkMinesGameRouter,
});
export type AppRouter = typeof appRouter;
