// Wagmi configuration for the web client.
//
// Wallet connection is powered by Wagmi + Viem. We support exactly two chains —
// Base and Base Sepolia — and three connectors so a player can use a browser
// extension wallet (injected / EIP-6963 discovered), Coinbase Wallet, or any
// mobile wallet over WalletConnect.

import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

import { env } from "@platform/env/web";

export const chains = [base, baseSepolia] as const;

export type SupportedChainId = (typeof chains)[number]["id"];

/** Chain ids the game accepts. Anything else triggers a network-switch prompt. */
export const supportedChainIds: readonly number[] = chains.map((c) => c.id);

/**
 * The chain we ask players to switch to. Driven by `VITE_CARD_WARS_CHAIN_ID`,
 * falling back to Base if that value isn't one of the supported chains.
 */
export const defaultChainId: SupportedChainId =
  env.VITE_CARD_WARS_CHAIN_ID !== undefined &&
  supportedChainIds.includes(env.VITE_CARD_WARS_CHAIN_ID)
    ? (env.VITE_CARD_WARS_CHAIN_ID as SupportedChainId)
    : base.id;

export function isSupportedChain(chainId: number | undefined): boolean {
  return chainId !== undefined && supportedChainIds.includes(chainId);
}

const connectors = [
  injected(),
  coinbaseWallet({ appName: "Card Wars" }),
  ...(env.VITE_WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: env.VITE_WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

// Make the typed Wagmi hooks aware of our config.
declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

/**
 * Turn a Wagmi/Viem error into a clear, user-friendly message. Wagmi errors
 * expose a stable `name` we can switch on; we fall back to the human-readable
 * `shortMessage` before the raw message.
 */
export function walletErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Something went wrong with your wallet. Please try again.";
  }

  const { name, shortMessage, message } = error as {
    name?: string;
    shortMessage?: string;
    message?: string;
  };

  switch (name) {
    case "UserRejectedRequestError":
      return "You rejected the request in your wallet.";
    case "ConnectorAlreadyConnectedError":
      return "That wallet is already connected.";
    case "ProviderNotFoundError":
    case "ConnectorNotFoundError":
      return "No wallet detected. Install a browser wallet, or connect a mobile wallet with WalletConnect.";
    case "ChainNotConfiguredError":
      return "That network isn't supported. Switch to Base or Base Sepolia.";
    case "SwitchChainNotSupportedError":
      return "Your wallet can't switch networks automatically — please switch to Base manually.";
    case "ResourceUnavailableRpcError":
      return "Your wallet is busy with another request. Check your wallet and try again.";
    case "ConnectorAccountNotFoundError":
      return "No account found in your wallet. Unlock it and try again.";
    default:
      return shortMessage || message || "Wallet connection failed. Please try again.";
  }
}
