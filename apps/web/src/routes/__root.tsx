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
import { ThemeProvider } from "@/components/theme-provider";
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
        title: "platform",
      },
      {
        name: "description",
        content: "platform is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
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
        href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullscreenGame = pathname.startsWith("/game/");

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        {isFullscreenGame ? (
          <div className="h-svh w-full overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <div className="grid h-svh grid-rows-[auto_1fr]">
            <Header />
            <main className="min-h-0 overflow-auto">
              <Outlet />
            </main>
          </div>
        )}
        <Toaster richColors />
      </ThemeProvider>
      {!isFullscreenGame && <TanStackRouterDevtools position="bottom-left" />}
      {!isFullscreenGame && <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />}
    </>
  );
}
