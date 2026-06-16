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

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 ring-1 ring-cyan-400/30">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 text-cyan-300"
          aria-hidden="true"
        >
          <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span
          style={displayStyle}
          className="text-xs font-semibold tracking-wide text-cyan-200 uppercase"
        >
          Verified by
        </span>
        <span
          style={displayStyle}
          className="text-xs font-bold tracking-[0.18em] text-cyan-100 uppercase"
        >
          ZK Verify
        </span>
      </div>

      <nav className="flex items-center gap-8">
        <a
          href="#about"
          style={displayStyle}
          className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase transition-colors hover:text-white"
        >
          About Us
        </a>
        <a
          href="#leaderboard"
          style={displayStyle}
          className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase transition-colors hover:text-white"
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
              className="rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 px-6 py-2 text-xs font-bold tracking-[0.2em] text-slate-900 uppercase shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105 disabled:opacity-50"
            >
              {isConnected ? (onBase ? "Connected" : "Wrong Net") : "Connect Wallet"}
            </button>
          )}
        </ConnectButton.Custom>
      </nav>
    </header>
  );
}