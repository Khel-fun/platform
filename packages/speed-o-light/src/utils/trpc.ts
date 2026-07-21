import type { SpeedOLightAppRouter } from "@platform/api/routers/index";
import { env } from "@platform/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

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

export const trpcClient = createTRPCClient<SpeedOLightAppRouter>({
  links: [
    httpBatchLink({
      url: `${env.VITE_SPEED_O_LIGHT_BACKEND_URL}/trpc`,
      headers: { "ngrok-skip-browser-warning": "true" },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<SpeedOLightAppRouter>({
  client: trpcClient,
  queryClient,
});

const trpcRuntime = { queryClient, trpcClient, trpc } as const;

export default trpcRuntime;
