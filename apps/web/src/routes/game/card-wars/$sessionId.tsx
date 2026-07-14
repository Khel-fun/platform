import { CardWarsGame, CardWarsProviders } from "@platform/card-wars";
import { Link, createFileRoute } from "@tanstack/react-router";

import "@platform/card-wars/styles.css";

export const Route = createFileRoute("/game/card-wars/$sessionId")({
  component: CardWarsSessionRoute,
});

function CardWarsSessionRoute() {
  const { sessionId } = Route.useParams();

  return (
    <CardWarsProviders>
      <div className="card-wars-root h-svh w-full overflow-hidden">
        <Link
          to="/"
          className="fixed right-4 top-4 z-50 rounded-full border border-emerald-500/40 bg-black/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200 backdrop-blur hover:bg-black/80"
        >
          ← Home
        </Link>
        <CardWarsGame sessionId={sessionId} />
      </div>
    </CardWarsProviders>
  );
}
