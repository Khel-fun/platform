import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const GAMES = [
  {
    id: "card-wars",
    name: "Card Wars",
    description: "Real-time 1v1 War card game with provably fair decks",
    to: "/game/card-wars",
    accent: "from-amber-600 to-orange-900",
  },
  {
    id: "speed-o-light",
    name: "Speed-o-Light",
    description: "60-second reflex sprint — avoid bombs, harvest XP",
    to: "/game/speed-o-light",
    accent: "from-violet-700 to-indigo-950",
  },
  {
    id: "zk-mines",
    name: "zkMines",
    description: "Cryptographically verifiable minesweeper with ZK proofs",
    to: "/game/zk-mines",
    accent: "from-emerald-700 to-slate-950",
  },
] as const;

function HomePage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">KheloFun</h1>
      <p className="mb-8 text-muted-foreground">Pick a game to play</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <Link
            key={game.id}
            to={game.to}
            className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <div className={`mb-4 h-2 rounded-full bg-gradient-to-r ${game.accent}`} />
            <h2 className="mb-2 text-lg font-semibold group-hover:text-primary">{game.name}</h2>
            <p className="text-sm text-muted-foreground">{game.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
