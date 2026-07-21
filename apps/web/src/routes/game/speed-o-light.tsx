import { SpeedOLightGame, SpeedOLightProviders } from "@platform/speed-o-light";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useAccount, useDisconnect } from "wagmi";

import "@platform/speed-o-light/styles.css";

export const Route = createFileRoute("/game/speed-o-light")({
  component: SpeedOLightRoute,
});

function SpeedOLightRoute() {
  const { address, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const walletBridge = {
    ...(address ? { address } : {}),
    isConnecting,
    ...(openConnectModal ? { connect: openConnectModal } : {}),
    disconnect,
  };

  return (
    <SpeedOLightProviders>
      <div className="game-shell-speed-o-light h-svh w-full overflow-auto">
        <Link
          to="/"
          className="fixed right-4 top-4 z-50 rounded-full border border-white/25 bg-black/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur hover:bg-black/80"
        >
          ← Home
        </Link>
        <SpeedOLightGame walletBridge={walletBridge} />
      </div>
    </SpeedOLightProviders>
  );
}
