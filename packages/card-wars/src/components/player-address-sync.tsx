import { useEffect } from "react";
import { useAccount } from "wagmi";

import { setPlayerAddress } from "../utils/player";

/**
 * Bridges the connected wallet address into the module-level player store that
 * the tRPC client reads for request identity. Renders nothing.
 */
export function PlayerAddressSync() {
  const { address } = useAccount();

  useEffect(() => {
    setPlayerAddress(address ?? null);
  }, [address]);

  return null;
}
