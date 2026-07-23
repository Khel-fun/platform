import { Toaster } from "@platform/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { WalletProviders } from "@/components/wallet-providers";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Khel.fun — Provably Fair Game Play",
      },
      {
        name: "description",
        content: "Khel.fun — provably fair on-chain games. Play Card Wars, Speed-o-Light and zkMines.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/khel-logo.png",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Rajdhani:wght@500;600;700&display=swap",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullscreenGame = pathname.startsWith("/game/");
  const showDevtools =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug");

  return (
    <>
      <HeadContent />
      <WalletProviders>
        {isFullscreenGame ? (
          <div className="h-svh w-full overflow-auto">
            <Outlet />
          </div>
        ) : (
          <div className="h-svh overflow-auto">
            <Header />
            <Outlet />
          </div>
        )}
      </WalletProviders>
      <Toaster richColors />
      {!isFullscreenGame && showDevtools && <TanStackRouterDevtools position="bottom-left" />}
      {!isFullscreenGame && showDevtools && <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />}
    </>
  );
}
