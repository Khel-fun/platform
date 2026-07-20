import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { queryClient } from "../utils/trpc";
import { wagmiConfig } from "../utils/wagmi";
import { PlayerAddressSync } from "./player-address-sync";

/**
 * Card Wars runtime context. The game talks to its own independent backend, so
 * it brings its own wallet (Wagmi) and react-query clients — the platform shell
 * intentionally does not wrap `/game/*` routes in wallet providers.
 * `PlayerAddressSync` bridges the connected address into the tRPC identity.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <PlayerAddressSync />
        <div className="dark h-full bg-black text-foreground">{children}</div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
