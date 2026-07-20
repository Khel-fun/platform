import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";

import { homeBgDesktop, homeBgMobile } from "@platform/ui/lib/assets";

import { ConnectWallet } from "../components/connect-wallet";
import {
  CardWarsTitle,
  pillButtonClass,
  truncateAddress,
} from "../components/game-ui";
import { trpc } from "../utils/trpc";
import { isSupportedChain } from "../utils/wagmi";

export default function CardWarsHome() {
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const ready = isConnected && isSupportedChain(chainId);

  const toGame = (sessionId: string) =>
    navigate({ to: "/game/card-wars/$sessionId", params: { sessionId } });

  // PLAY enqueues the player; if no opponent is waiting we poll until one is.
  const join = useMutation({
    ...trpc.cardWars.joinQueue.mutationOptions(),
    onSuccess: (res) => {
      if (res.status === "matched") toGame(res.sessionId);
    },
  });
  const resetJoin = join.reset;

  const waiting = join.data?.status === "waiting";
  const searching = join.isPending || waiting;

  const poll = useQuery({
    ...trpc.cardWars.pollMatch.queryOptions(),
    enabled: waiting,
    refetchInterval: 1500,
  });

  useEffect(() => {
    if (poll.data?.status === "matched") toGame(poll.data.sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.data]);

  const [safeToPlay, setSafeToPlay] = useState(false);
  useEffect(() => {
    if (ready) {
      const timer = setTimeout(() => setSafeToPlay(true), 400);
      return () => clearTimeout(timer);
    }

    setSafeToPlay(false);
    // If the user disconnects or switches to a wrong network,
    // clear any leftover "waiting" state from the previous queue attempt.
    resetJoin();
  }, [ready, resetJoin]);

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
          <>
            {searching ? (
              <p className="pt-8 font-ui text-[20px] font-semibold uppercase tracking-widest text-white/70">
                fetching opponent ...
              </p>
            ) : (
              <button
                type="button"
                className={pillButtonClass}
                disabled={join.isPending || !safeToPlay}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (safeToPlay) join.mutate();
                }}
              >
                PLAY
              </button>
            )}
          </>
        )}

        {join.error && !searching && (
          <p className="font-ui text-sm text-red-400">{join.error.message}</p>
        )}
      </div>
    </div>
  );
}
