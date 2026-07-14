import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { PlayerAddressSync } from "./player-address-sync";
import { queryClient } from "../utils/trpc";
import { wagmiConfig } from "../utils/wagmi";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div className="dark h-full bg-black text-foreground">
          <PlayerAddressSync />
          {children}
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
