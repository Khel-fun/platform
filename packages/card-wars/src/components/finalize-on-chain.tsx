// Permissionless fallback control for the game-over screen.
//
// The backend relays the finalization tx automatically on the normal path. This
// lets a participant submit the same backend-signed payload from their own
// wallet if the backend couldn't — the contract dedupes via sessionStatus, so a
// concurrent submit just reverts SessionAlreadyFinalized (a benign success).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { gradientButtonClass } from "../components/game-ui";
import { trpc } from "../utils/trpc";
import { gameRegistryAbi, toContractResult } from "../utils/registry";
import { isSupportedChain, type SupportedChainId } from "../utils/wagmi";

export function FinalizeOnChain({ sessionId }: { sessionId: string }) {
  const payload = useQuery(
    trpc.cardWars.finalizationPayload.queryOptions({ sessionId }),
  );
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [confirmedByRevert, setConfirmedByRevert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receipt = useWaitForTransactionReceipt({ hash });

  const data = payload.data;
  if (payload.isLoading) {
    return (
      <button type="button" className={gradientButtonClass} disabled>
        Loading publish...
      </button>
    );
  }

  if (payload.isError) {
    return (
      <p className="font-ui text-xs text-red-400">
        Publish unavailable: {payload.error.message}
      </p>
    );
  }

  if (!data || !data.configured) {
    return (
      <button type="button" className={gradientButtonClass} disabled>
        Publish unavailable
      </button>
    );
  }

  const settled = data.alreadyFinalized || receipt.isSuccess || confirmedByRevert;

  if (!isSupportedChain(data.chainId)) {
    return (
      <p className="font-ui text-xs text-red-400">
        On-chain settlement is configured for an unsupported network.
      </p>
    );
  }
  const targetChainId = data.chainId as SupportedChainId;

  const onFinalize = async () => {
    setError(null);
    try {
      if (chainId !== targetChainId) {
        await switchChainAsync({ chainId: targetChainId });
      }
      const tx = await writeContractAsync({
        address: data.contractAddress,
        abi: gameRegistryAbi,
        functionName: "finalizeSession",
        args: [toContractResult(data.result), data.signature],
        chainId: targetChainId,
      });
      setHash(tx);
    } catch (err) {
      const message =
        (err as { shortMessage?: string; message?: string })?.shortMessage ??
        (err as Error)?.message ??
        "Submission failed";
      // Someone (backend or opponent) already settled it — treat as success.
      if (message.includes("SessionAlreadyFinalized")) {
        setConfirmedByRevert(true);
      } else {
        setError(message);
      }
    }
  };

  const busy = isPending || receipt.isLoading;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        className={gradientButtonClass}
        disabled={!isConnected || busy || settled}
        onClick={onFinalize}
      >
        {settled ? "Published Onchain" : busy ? "Finalizing..." : "Submit Game Onchain"}
      </button>
      {error && <p className="font-ui text-xs text-red-400">{error}</p>}
    </div>
  );
}
