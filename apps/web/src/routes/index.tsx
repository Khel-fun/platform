import { Link, createFileRoute } from "@tanstack/react-router";

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
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,80,160,0.25),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(120,40,140,0.25),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(30,80,140,0.3),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 60px 120px, white, transparent), radial-gradient(1.5px 1.5px at 140px 80px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 220px 200px, white, transparent), radial-gradient(1.5px 1.5px at 300px 50px, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 380px 160px, white, transparent), radial-gradient(1px 1px at 460px 30px, white, transparent), radial-gradient(1.5px 1.5px at 540px 220px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 620px 100px, white, transparent), radial-gradient(1px 1px at 700px 180px, white, transparent), radial-gradient(1.5px 1.5px at 780px 40px, rgba(255,255,255,0.85), transparent), radial-gradient(1px 1px at 860px 220px, white, transparent), radial-gradient(1px 1px at 940px 90px, white, transparent), radial-gradient(1.5px 1.5px at 1020px 200px, rgba(255,255,255,0.9), transparent), radial-gradient(1px 1px at 1100px 60px, white, transparent), radial-gradient(1px 1px at 1180px 180px, white, transparent), radial-gradient(2px 2px at 150px 320px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 420px 380px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 760px 340px, rgba(255,255,255,0.7), transparent), radial-gradient(2px 2px at 1080px 400px, rgba(255,255,255,0.7), transparent)",
            backgroundRepeat: "repeat",
            backgroundSize: "1200px 600px",
          }}
        />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center px-6 py-10">
        <div className="mb-2 flex flex-col items-center">
          <img
            src="/khel-logo.png"
            alt="Khel.fun"
            className="h-32 w-auto drop-shadow-[0_0_30px_rgba(255,140,40,0.35)] sm:h-40 md:h-48"
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
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform hover:-translate-y-1 hover:ring-white/20"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden">
                <img
                  src={game.image}
                  alt={game.name}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-5 pt-10">
                <h2
                  className="text-base font-bold tracking-[0.18em] text-white uppercase drop-shadow-lg sm:text-lg"
                  style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                >
                  {game.name}
                </h2>
                <span
                  className="rounded-full bg-gradient-to-r from-orange-400 to-orange-500 px-5 py-1.5 text-[10px] font-bold tracking-[0.25em] text-white uppercase shadow-lg shadow-orange-500/40 transition-transform group-hover:scale-105"
                  style={{ fontFamily: "Rajdhani, Inter, sans-serif" }}
                >
                  Launch
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}