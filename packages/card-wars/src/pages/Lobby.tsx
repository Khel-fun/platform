import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { homeBgDesktop, homeBgMobile } from "@platform/ui/lib/assets";

import { CardWarsTitle, pillButtonClass } from "../components/game-ui";
import { getCardWarsBackendUrl, getCardWarsSocket } from "../lib/socket";

type GameStartPayload = {
  gameId: string;
  player1Id?: string;
  player2Id?: string;
  cardCounts?: Record<string, number>;
};

export default function CardWarsLobby() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [message, setMessage] = useState("Connecting to Card Wars backend...");

  useEffect(() => {
    if (!isConnected || !address) {
      void navigate({ to: "/game/card-wars" });
      return;
    }

    const socket = getCardWarsSocket();
    const onConnect = () => {
      setMessage("Waiting for opponent...");
      socket.emit("join_queue", { walletAddress: address });
    };
    const onQueueJoined = () => setMessage("Waiting for opponent...");
    const onGameStart = (payload: GameStartPayload) => {
      sessionStorage.setItem("cardWarsGame", JSON.stringify(payload));
      void navigate({ to: "/game/card-wars/play" });
    };
    const onError = (error: { message?: string } | string) => {
      setMessage(typeof error === "string" ? error : error.message ?? "Card Wars backend error");
    };

    socket.on("connect", onConnect);
    socket.on("queue_joined", onQueueJoined);
    socket.on("game_start", onGameStart);
    socket.on("error", onError);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("queue_joined", onQueueJoined);
      socket.off("game_start", onGameStart);
      socket.off("error", onError);
    };
  }, [address, isConnected, navigate]);

  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center overflow-hidden">
      <img src={homeBgDesktop} alt="" aria-hidden className="absolute inset-0 hidden h-full w-full object-cover sm:block" />
      <img src={homeBgMobile} alt="" aria-hidden className="absolute inset-0 block h-full w-full object-cover sm:hidden" />
      <div className="relative z-10 flex max-w-xl flex-col items-center gap-8 px-6 text-center">
        <CardWarsTitle className="text-7xl sm:text-8xl" />
        <Loader2 className="size-10 animate-spin text-[#2AC390]" />
        <p className="font-ui text-[22px] font-semibold uppercase tracking-widest text-white/80">
          {message}
        </p>
        <p className="max-w-md font-ui text-sm leading-6 text-white/55">
          Using independent backend: {getCardWarsBackendUrl()}
        </p>
        <button type="button" className={pillButtonClass} onClick={() => navigate({ to: "/game/card-wars" })}>
          cancel
        </button>
      </div>
    </div>
  );
}
