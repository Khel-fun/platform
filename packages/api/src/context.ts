import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

type ContextOptions = CreateExpressContextOptions | CreateWSSContextFnOptions;

function readPlayerAddress(opts: ContextOptions): string | null {
  const fromParams = (opts as CreateWSSContextFnOptions).info?.connectionParams?.playerAddress;
  const headerRaw = (opts as CreateExpressContextOptions).req?.headers?.["x-player-address"];
  const fromHeader = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const value = (fromParams ?? fromHeader)?.trim();
  return value ? value.toLowerCase() : null;
}

export async function createContext(opts: ContextOptions) {
  return {
    auth: null,
    session: null,
    playerAddress: readPlayerAddress(opts),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
