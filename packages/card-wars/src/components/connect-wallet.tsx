import {
  useConnect,
  useAccount,
  useConnectors,
  useSwitchChain,
} from "wagmi";
import { AlertTriangle, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@platform/ui/components/dropdown-menu";

import { pillButtonClass } from "../components/game-ui";
import { defaultChainId, isSupportedChain, walletErrorMessage } from "../utils/wagmi";

const walletMenuContentClass =
  "min-w-[250px] border border-white/10 bg-[#151515] p-0 text-white " +
  "shadow-[0_18px_44px_rgba(0,0,0,0.45)] ring-0";

const walletMenuLabelClass =
  "px-2.5 py-2 font-ui text-[12px] leading-5 text-white/70";

const walletMenuItemClass =
  "cursor-pointer gap-2.5 px-2.5 py-2 font-ui text-[13px] leading-5 text-white " +
  "focus:bg-white/8 focus:text-white";

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending: isConnecting } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // 1. Connected to an unsupported network — prompt a switch before anything else.
  if (isConnected && !isSupportedChain(chainId)) {
    return (
      <div className="flex items-center gap-2 text-[#E7973F]">
        <AlertTriangle className="size-6" />
        <span className="font-ui text-[20px] tracking-wide">Wrong Network</span>
        <button
          type="button"
          disabled={isSwitching}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            switchChain(
              { chainId: defaultChainId },
              { onError: (error) => toast.error(walletErrorMessage(error)) },
            );
          }}
          className="font-ui text-[20px] tracking-wide underline decoration-1 underline-offset-[3px] hover:text-[#f8b66f]"
        >
          {isSwitching ? "switching…" : "switch network"}
        </button>
      </div>
    );
  }

  // 2. Connected on a supported network — show the account + disconnect menu.
  if (isConnected && address) {
    // Return null here because `index.tsx` handles rendering the address and logout 
    // icon when the user is connected.
    return null;
  }

  // 3. Disconnected — let the player pick a wallet (browser or mobile).
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={pillButtonClass} disabled={isConnecting} />}
      >
        {isConnecting ? "Connecting…" : "connect wallet"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={walletMenuContentClass}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={walletMenuLabelClass}>
            Choose a wallet
          </DropdownMenuLabel>
          {connectors.map((c) => (
            <DropdownMenuItem
              key={c.uid}
              className={walletMenuItemClass}
              onClick={() =>
                connect(
                  { connector: c },
                  { onError: (error) => toast.error(walletErrorMessage(error)) },
                )
              }
            >
              {c.icon ? (
                <img src={c.icon} alt="" className="size-4 rounded-sm" />
              ) : (
                <Wallet />
              )}
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
