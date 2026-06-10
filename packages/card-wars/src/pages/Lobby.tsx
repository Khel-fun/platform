import { useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { useGameStore } from "@/store/gameStore";
import { useSocket, emitJoinQueue } from "@/hooks/useSocket";
import { asset } from "@/lib/assets";

const FIRE = `
  radial-gradient(ellipse at 15% 70%, rgba(251,146,60,0.2) 0%, transparent 45%),
  radial-gradient(ellipse at 85% 70%, rgba(239,68,68,0.15) 0%, transparent 45%)
`;

const panelStyle = {
  background: "rgba(0,0,0,0.55)",
  border: "1px solid rgba(120,80,26,0.6)",
  boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,200,50,0.07)",
};

export default function CardWarsLobby() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const { status, reset } = useGameStore();

  useSocket(address);

  useEffect(() => {
    if (status === "active") {
      void navigate({ to: "/game/card-wars/play" });
    }
  }, [status, navigate]);

  const handleJoinQueue = () => {
    if (!address) return;
    reset();
    emitJoinQueue(address);
  };

  if (!isConnected) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6 relative bg-cover bg-center"
        style={{ backgroundImage: `url(${asset("/bg.png")})` }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: FIRE }} />
        <p
          className="relative z-10 font-bold tracking-widest uppercase text-sm"
          style={{ color: "rgba(245,200,80,0.6)" }}
        >
          Connect your wallet to enter the battle
        </p>
        <div className="relative z-10">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 gap-8 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${asset("/bg.png")})` }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: FIRE }} />

      <Link to="/game/card-wars" className="absolute top-5 left-6 z-20">
        <motion.button className="relative" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <img src={asset("/back.png")} alt="Back" width={150} height={50} className="object-contain" />
        </motion.button>
      </Link>

      <motion.div
        className="relative z-10 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1
          className="font-black tracking-[0.15em] leading-none mb-1"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 4rem)",
            color: "#f5c842",
            textShadow: "0 0 30px rgba(245,158,11,0.6), 0 3px 6px rgba(0,0,0,0.9)",
            fontFamily: "Georgia, serif",
          }}
        >
          LOBBY
        </h1>
        <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.95)" }}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </p>
      </motion.div>

      <motion.div
        className="relative z-10 rounded-2xl p-8 w-full max-w-md flex flex-col gap-6"
        style={panelStyle}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        {status === "idle" && (
          <motion.button
            onClick={handleJoinQueue}
            className="w-full flex items-center justify-center"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <img
              src={asset("/find.png")}
              alt="Find Match"
              width={300}
              height={80}
              className="object-contain"
            />
          </motion.button>
        )}

        {status === "queued" && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#b8860b" }}
                  animate={{ y: [0, -10, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
                />
              ))}
            </div>
            <p
              className="font-bold tracking-widest text-sm uppercase"
              style={{ color: "rgba(245,200,80,0.7)" }}
            >
              Seeking opponent...
            </p>
            <button
              onClick={() => reset()}
              className="text-xs uppercase tracking-widest underline"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Cancel
            </button>
          </div>
        )}
      </motion.div>

      <p
        className="relative z-10 text-xs text-center max-w-sm"
        style={{ color: "rgba(255,255,255,0.6)" }}
      >
        Games are provably fair — deck hash published before cards are dealt.
      </p>
    </div>
  );
}
