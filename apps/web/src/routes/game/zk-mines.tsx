import { ZkMinesGame, ZkMinesProviders } from "@platform/zk-mines";
import { Link, createFileRoute } from "@tanstack/react-router";

import "@platform/zk-mines/styles.css";

export const Route = createFileRoute("/game/zk-mines")({
  component: ZkMinesRoute,
});

function ZkMinesRoute() {
  return (
    <ZkMinesProviders>
      <div className="h-svh w-full overflow-auto">
        <Link
          to="/"
          className="fixed right-4 top-4 z-50 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur hover:bg-black/80"
        >
          ← Home
        </Link>
        <ZkMinesGame />
      </div>
    </ZkMinesProviders>
  );
}
