import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { asset } from "../lib/assets";

const FIRE = `
  radial-gradient(ellipse at 15% 70%, rgba(251,146,60,0.22) 0%, transparent 45%),
  radial-gradient(ellipse at 85% 70%, rgba(239,68,68,0.18) 0%, transparent 45%),
  radial-gradient(ellipse at 50% 90%, rgba(245,158,11,0.1) 0%, transparent 50%)
`;

export default function CardWarsHome() {
  const { isConnected } = useAccount();

  return (
    <div
      className="flex min-h-svh h-full w-full flex-col items-center justify-center px-4 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${asset("/home_bg.png")})` }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: FIRE }} />

      <motion.div
        className="relative z-10 text-center max-w-lg w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="flex flex-col items-center gap-5 mb-10">
          <ConnectButton />

          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="w-full"
            >
              <Link to="/game/card-wars/lobby">
                <motion.button
                  className="w-full py-4 px-8 font-black text-xl tracking-[0.15em] uppercase rounded-lg"
                  style={{
                    background: "linear-gradient(to bottom, #b8860b, #7a4f00)",
                    border: "2px solid #f5c842",
                    color: "#fff8e0",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    boxShadow: "0 0 30px rgba(245,158,11,0.5), 0 4px 16px rgba(0,0,0,0.8)",
                  }}
                  whileHover={{ scale: 1.04, boxShadow: "0 0 50px rgba(245,158,11,0.8)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  ENTER BATTLE
                </motion.button>
              </Link>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: "⚡", title: "Real-time", desc: "WebSocket instant gameplay" },
            { icon: "🔒", title: "Fair", desc: "Deck hash published before game" },
            { icon: "🎮", title: "PvP", desc: "Challenge players worldwide" },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl p-4 text-center"
              style={{
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(120,80,26,0.5)",
                boxShadow: "inset 0 1px 0 rgba(245,200,50,0.06)",
              }}
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <p
                className="font-bold text-xl mb-1"
                style={{ color: "#d4a74a", fontFamily: "Georgia, serif" }}
              >
                {f.title}
              </p>
              <p className="text-md font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
