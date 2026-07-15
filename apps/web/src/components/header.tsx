import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogOut } from "lucide-react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { base } from "wagmi/chains";

const displayStyle: React.CSSProperties = {
  fontFamily: "Rajdhani, Inter, sans-serif",
};

function shortAddress(address: string) {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Header() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const onBase = chainId === base.id;
  const openLeaderboard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.replaceState(null, "", "/#leaderboard");
    window.dispatchEvent(new CustomEvent("open-leaderboard"));
  };

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 hidden items-center justify-between px-11 py-9 text-white sm:flex lg:px-[44px]">
      <div className="pointer-events-auto flex items-center gap-2 text-[#99ffa5]">
        <span className="grid size-[11.5px] place-items-center rounded-full border border-[#99ffa5]/80 bg-[#99ffa5]/30">
          <span className="size-[5.5px] rounded-full bg-[#99ffa5]" />
        </span>
        <span
          style={displayStyle}
          className="text-xs font-medium tracking-normal lowercase text-[#99ffa5]"
        >
          verified on
        </span>
        <span
          style={displayStyle}
          className="grid size-[19px] place-items-center rounded-[5px] bg-[#99ffa5] text-[10px] font-black leading-none text-[#041127]"
        >
          <img src='zkverify.png'/>
        </span>
      </div>

      <nav className="pointer-events-auto flex items-center gap-16">
        <a
          href="/#about"
          style={displayStyle}
          className="text-base font-medium text-white transition-colors hover:text-[#99ffa5]"
        >
          ABOUT US
        </a>
        <a
          href="/#leaderboard"
          onClick={openLeaderboard}
          style={displayStyle}
          className="text-base font-medium text-white transition-colors hover:text-[#99ffa5]"
        >
          LEADERBOARD
        </a>
        <ConnectButton.Custom>
          {({ account, openConnectModal, mounted }) => {
            const walletAddress = address ?? account?.address ?? "";
            const connectedLabel = onBase ? shortAddress(walletAddress) : "wrong net";

            if (isConnected || account) {
              return (
                <div
                  style={displayStyle}
                  className="inline-flex h-[33px] items-center overflow-hidden rounded-full border border-white/90 bg-[radial-gradient(circle_at_24%_-120%,#07f49e_0%,#257c8e_48%,#42047e_100%)] text-[10px] font-medium lowercase text-white shadow-[0_0_22px_rgba(34,211,238,0.28)] transition-transform hover:scale-105 disabled:opacity-50"
                >
                  <button type="button" onClick={openConnectModal} disabled={!mounted} className="h-full px-[14px] disabled:opacity-50">
                    {connectedLabel}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      disconnect();
                    }}
                    disabled={!mounted}
                    aria-label="Disconnect wallet"
                    className="grid h-full w-9 place-items-center border-l border-white/90 bg-white/5 disabled:opacity-50"
                  >
                    <LogOut className="size-4" strokeWidth={2.1} />
                  </button>
                </div>
              );
            }

            return (
              <button
                type="button"
                onClick={openConnectModal}
                disabled={!mounted}
                style={displayStyle}
                className="h-[33px] rounded-full border border-white/90 bg-[radial-gradient(circle_at_24%_-120%,#07f49e_0%,#257c8e_48%,#42047e_100%)] px-[14px] text-base font-medium capitalize text-white shadow-[0_0_22px_rgba(34,211,238,0.28)] transition-transform hover:scale-105 disabled:opacity-50"
              >
                connect wallet
              </button>
            );
          }}
        </ConnectButton.Custom>
      </nav>
    </header>
  );
}
