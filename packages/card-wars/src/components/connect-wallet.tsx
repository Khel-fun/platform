import type { Connector } from "wagmi";
import { useAccount, useConnect, useConnectors, useSwitchChain } from "wagmi";
import { AlertTriangle, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@platform/ui/components/dropdown-menu";

import { pillButtonClass } from "./game-ui";
import {
  CoinbaseIcon,
  MetaMaskIcon,
  PhantomIcon,
  RainbowIcon,
  WalletConnectIcon,
} from "./wallet-icons";
import { defaultChainId, isSupportedChain, walletErrorMessage } from "../utils/wagmi";

const walletMenuContentClass =
  "cw-wallet-menu overflow-hidden !rounded-[40px] px-6 py-8 text-white !ring-0";

const walletMenuItemClass =
  "cursor-pointer gap-4 rounded-none px-0 py-0 font-ui text-[18px] leading-[22px] text-white " +
  "focus:bg-transparent focus:text-white hover:bg-transparent data-[highlighted]:bg-transparent";

type WalletIcon = typeof MetaMaskIcon;

function walletSortRank(connector: Connector): number {
  if (connector.id === "walletConnect") return 3;
  if (connector.id === "coinbaseWalletSDK") return 2;
  return 1;
}

function getWalletFallbackIcon(connector: Connector): WalletIcon | null {
  const haystack = `${connector.id} ${connector.name}`.toLowerCase();

  if (haystack.includes("metamask")) return MetaMaskIcon;
  if (haystack.includes("rainbow")) return RainbowIcon;
  if (haystack.includes("phantom")) return PhantomIcon;
  if (haystack.includes("coinbase")) return CoinbaseIcon;
  if (haystack.includes("walletconnect")) return WalletConnectIcon;

  return null;
}

function WalletConnectorIcon({ connector }: { connector: Connector }) {
  const FallbackIcon = getWalletFallbackIcon(connector);

  if (connector.icon) {
    return (
      <img
        src={connector.icon}
        alt=""
        className="size-5 shrink-0 rounded-[4px]"
      />
    );
  }

  if (FallbackIcon) {
    return <FallbackIcon className="size-5 shrink-0 rounded-[4px]" />;
  }

  return <Wallet className="size-5 shrink-0 text-white/80" />;
}

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending: isConnecting } = useConnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const walletOptions = [...connectors].sort(
    (a, b) => walletSortRank(a) - walletSortRank(b) || a.name.localeCompare(b.name),
  );

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
    // Return null here because `Home` handles rendering the address and logout
    // icon when the user is connected.
    return null;
  }

  // 3. Disconnected — list installed browser wallets (EIP-6963) plus Coinbase + WC.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className={pillButtonClass} disabled={isConnecting} />}
      >
        {isConnecting ? "Connecting…" : "connect wallet"}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={12}
        className={walletMenuContentClass}
      >
        <DropdownMenuGroup className="relative z-10 flex flex-col gap-5">
          {walletOptions.map((connector) => (
            <DropdownMenuItem
              key={connector.uid}
              className={walletMenuItemClass}
              onClick={() =>
                connect(
                  { connector },
                  { onError: (error) => toast.error(walletErrorMessage(error)) },
                )
              }
            >
              <WalletConnectorIcon connector={connector} />
              {connector.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
