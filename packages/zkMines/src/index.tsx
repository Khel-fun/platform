import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./lib/wagmi";
import { queryClient } from "./utils/trpc";

export function ZkMinesProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export { ZkMinesGame } from "./ZkMinesGame";
