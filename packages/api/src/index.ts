import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const playerProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.playerAddress) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing x-player-address header",
    });
  }

  return next({ ctx: { ...ctx, playerAddress: ctx.playerAddress } });
});
