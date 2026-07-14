import type { AppRouter } from "@platform/api/routers/index";
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

import { getPlayerAddress } from "./player";

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

// Live game updates flow over a WebSocket; everything else over HTTP. Both
// carry the player's identity — connectionParams for WS, header for HTTP.
//
// The WS connection is lazy: it only opens when a subscription starts (always
// in-game, i.e. after the wallet is connected), so connectionParams capture the
// player's address rather than an empty pre-connection value.
const wsClient = createWSClient({
  url: env.VITE_SERVER_URL.replace(/^http/, "ws"),
  connectionParams: () => ({ playerAddress: getPlayerAddress() ?? "" }),
  lazy: { enabled: true, closeMs: 0 },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({
        url: `${env.VITE_SERVER_URL}/trpc`,
        headers: () => {
          const address = getPlayerAddress();
          return {
            // Bypass the ngrok free-tier browser-warning interstitial, which
            // otherwise answers GET requests with an HTML page (no CORS headers)
            // before they reach Express. Header is allow-listed server-side.
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
