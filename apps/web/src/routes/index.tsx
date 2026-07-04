import { Link, createFileRoute } from "@tanstack/react-router";
import { MdOutlineArrowOutward } from "react-icons/md";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const GAMES = [
  {
    id: "card-wars",
    name: "Card-Wars",
    to: "/game/card-wars",
    image: "/card-wars.png",
  },
  {
    id: "speed-o-light",
    name: "Speed-o-Light",
    to: "/game/speed-o-light",
    image: "/speed-o-light.png",
  },
  {
    id: "zk-mines",
    name: "zk Mines",
    to: "/game/zk-mines",
    image: "/zkMines.png",
  },
] as const;

function HomePage() {
  return (
    <div className="relative min-h-full overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none fixed inset-0">
        <img
          src="/bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full flex-col items-center justify-center px-6 py-10">
        <div className="mb-2 flex flex-col items-center">
          <img
            src="/khel-logo.png"
            alt="Khel.fun"
            className="w-[550px] max-w-full h-auto drop-shadow-[0_0_30px_rgba(255,140,40,0.35)]"
          />
          <p
            className="mt-4 text-[10px] font-semibold tracking-[0.5em] text-white/70 uppercase sm:text-xs"
            style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
          >
            Provably Fair Game Play
          </p>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
          {GAMES.map((game) => (
            <Link
              key={game.id}
              to={game.to}
              className="group relative overflow-hidden rounded-md border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform hover:-translate-y-1 hover:ring-white/20"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-end gap-3 px-4 pb-5 pt-10">
                <h2
                  className="text-base font-bold tracking-[0.18em] text-white uppercase drop-shadow-lg sm:text-lg"
                  style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                >
                  {game.name}
                </h2>
                <div className="rounded-full bg-gradient-to-r flex items-center from-orange-400 to-orange-500 px-5 py-1.5 text-[10px] font-bold tracking-[0.25em] text-white uppercase shadow-lg shadow-orange-500/40 transition-transform group-hover:scale-105"
                  style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}>
                  <span>
                    PLAY NOW
                  </span>
                  <MdOutlineArrowOutward />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}