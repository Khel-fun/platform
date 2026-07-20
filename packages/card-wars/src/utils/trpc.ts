// tRPC client for Card Wars.
//
// The backend is an independent service reached at `VITE_CARD_WARS_BACKEND_URL`.
// Live game updates flow over a WebSocket (tRPC subscriptions); everything else
// over HTTP. Both carry the player's identity — connectionParams for WS, header
// for HTTP. The router *type* comes from the local contract in
// `../lib/trpc-contract` (the real implementation lives in the backend repo).

import { env } from "@platform/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import type { AppRouter } from "../lib/trpc-contract";
import { getPlayerAddress } from "./player";

/** Independent Card Wars backend base URL (HTTP origin). */
const BACKEND_URL = env.VITE_CARD_WARS_BACKEND_URL;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: query.invalidate,
        },
      });
    },
  }),
});

// The WS connection is lazy: it only opens when a subscription starts (always
// in-game, i.e. after the wallet is connected), so connectionParams capture the
// player's address rather than an empty pre-connection value.
const wsClient = createWSClient({
  url: BACKEND_URL.replace(/^http/, "ws"),
  connectionParams: () => ({ playerAddress: getPlayerAddress() ?? "" }),
  lazy: { enabled: true, closeMs: 0 },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: `${BACKEND_URL}/trpc`,
        headers: () => {
          const address = getPlayerAddress();
          return {
            // Bypass the ngrok free-tier browser-warning interstitial, which
            // otherwise answers GET requests with an HTML page (no CORS headers)
            // before they reach the backend. Header is allow-listed server-side.
            "ngrok-skip-browser-warning": "true",
            ...(address ? { "x-player-address": address } : {}),
          };
        },
      }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
