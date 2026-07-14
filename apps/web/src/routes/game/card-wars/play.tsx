import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/game/card-wars/play")({
  beforeLoad: () => {
    throw redirect({ to: "/game/card-wars" });
  },
});
