import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";

import { homeBgDesktop, homeBgMobile } from "@platform/ui/lib/assets";

import { ConnectWallet } from "../components/connect-wallet";
import {
  CardWarsTitle,
  pillButtonClass,
  truncateAddress,
} from "../components/game-ui";
import { isSupportedChain } from "../utils/wagmi";


export default function CardWarsHome() {
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const ready = isConnected && isSupportedChain(chainId);

  return (
    <div className="relative flex h-svh w-full flex-col items-center justify-center overflow-hidden">
      {/* Full-bleed background (leather + floating cards) — desktop / mobile. */}
      <img
        src={homeBgDesktop}
        alt=""
        aria-hidden
        className="absolute inset-0 hidden h-full w-full object-cover sm:block"
        draggable={false}
      />
      <img
        src={homeBgMobile}
        alt=""
        aria-hidden
        className="absolute inset-0 block h-full w-full object-cover sm:hidden"
        draggable={false}
      />

      <div className="absolute left-1/2 top-[255px] z-10 -translate-x-1/2 text-center sm:top-[290px]">
        <CardWarsTitle className="text-7xl sm:text-8xl" />
      </div>

      <div className="absolute left-1/2 top-[575px] z-10 flex min-h-32 -translate-x-1/2 flex-col items-center gap-6 px-6 text-center sm:top-[583px]">
        {address && (
          <button
            type="button"
            onClick={() => disconnect()}
            className="flex cursor-pointer items-center gap-3 font-button text-2xl tracking-wide text-white transition-colors hover:text-white/80"
            title="Disconnect"
          >
            <span>{truncateAddress(address)}</span>
            <LogOut className="size-6 text-[#2AC390]" />
          </button>
        )}

        {!ready ? (
          <div className={address ? "pt-2" : "pt-14"}>
            <ConnectWallet />
          </div>
        ) : (
          <Link to="/game/card-wars/lobby" className={pillButtonClass}>
            PLAY
          </Link>
        )}
      </div>
    </div>
  );
}
