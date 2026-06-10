import "@platform/ui/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";

import { StrictMode } from "react";
import ReactDOM, { type Root } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import CardWarsProviders from "./components/Providers";
import CardWarsGame from "./pages/Game";
import CardWarsHome from "./pages/Home";
import CardWarsLobby from "./pages/Lobby";

const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRoute,
});

const cardWarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game/card-wars",
  component: HomeRoute,
});

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game/card-wars/lobby",
  component: LobbyRoute,
});

const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game/card-wars/play",
  component: GameRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, cardWarsRoute, lobbyRoute, playRoute]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function RootComponent() {
  return (
    <CardWarsProviders>
      <div className="card-wars-root h-svh w-full overflow-auto">
        <Outlet />
      </div>
    </CardWarsProviders>
  );
}

function HomeRoute() {
  return <CardWarsHome />;
}

function LobbyRoute() {
  return <CardWarsLobby />;
}

function GameRoute() {
  return (
    <div className="h-svh w-full overflow-hidden">
      <CardWarsGame />
    </div>
  );
}

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

const cardWarsWindow = window as Window & { __cardWarsRoot?: Root };
const root = cardWarsWindow.__cardWarsRoot ?? ReactDOM.createRoot(rootElement);
cardWarsWindow.__cardWarsRoot = root;

root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
