import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { base } from "wagmi/chains";

const displayStyle: React.CSSProperties = {
  fontFamily: "Rajdhani, Inter, sans-serif",
};

export default function Header() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const onBase = chainId === base.id;
  const openLeaderboard = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.history.replaceState(null, "", "/#leaderboard");
    window.dispatchEvent(new CustomEvent("open-leaderboard"));
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 text-white sm:px-10 sm:py-7 lg:px-[7.5vw]">
      <a href="/#about" className="block sm:hidden" aria-label="Khel.fun home">
        <img
          src="/khel-logo.png"
          alt="Khel.fun"
          className="h-11 w-auto drop-shadow-[0_0_18px_rgba(255,140,40,0.24)]"
        />
      </a>

      <div className="hidden items-center gap-2 sm:flex">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]"
          aria-hidden="true"
        >
          <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span
          style={displayStyle}
          className="text-[10px] font-semibold tracking-wide text-white/70 lowercase sm:text-xs"
        >
          verified on
        </span>
        <span
          style={displayStyle}
          className="text-[10px] font-bold tracking-[0.16em] text-emerald-300 uppercase sm:text-xs"
        >
          ZK
        </span>
      </div>

      <nav className="flex items-center gap-4 sm:gap-8">
        <a
          href="/#games"
          style={displayStyle}
          className="text-[10px] font-medium text-white/86 transition-colors hover:text-white sm:hidden"
        >
          Games
        </a>
        <a
          href="/#about"
          style={displayStyle}
          className="hidden text-[10px] font-semibold tracking-[0.2em] text-white/80 uppercase transition-colors hover:text-white sm:inline sm:text-xs"
        >
          About Us
        </a>
        <a
          href="/#leaderboard"
          onClick={openLeaderboard}
          style={displayStyle}
          className="rounded-full bg-white px-4 py-2 text-[10px] font-bold text-[#070923] transition-transform hover:scale-105 sm:bg-transparent sm:px-0 sm:py-0 sm:text-xs sm:font-semibold sm:tracking-[0.2em] sm:text-white/80 sm:uppercase sm:hover:scale-100 sm:hover:text-white"
        >
          Leaderboard
        </a>
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => (
            <button
              type="button"
              onClick={openConnectModal}
              disabled={!mounted}
              style={displayStyle}
              className="hidden rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-6 py-2 text-[10px] font-bold tracking-[0.18em] text-white uppercase shadow-[0_0_24px_rgba(34,211,238,0.22)] transition-transform hover:scale-105 disabled:opacity-50 sm:block"
            >
              {isConnected ? (onBase ? "Connected" : "Wrong Net") : "Connect Wallet"}
            </button>
          )}
        </ConnectButton.Custom>
      </nav>
    </header>
  );
}
