import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "../utils/wagmi";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <div className="dark h-full bg-black text-foreground">{children}</div>
    </WagmiProvider>
  );
}
