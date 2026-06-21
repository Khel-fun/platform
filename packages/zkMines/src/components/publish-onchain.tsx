import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { base } from "wagmi/chains";
import { Button } from "@platform/ui/components/button";
import { trpcClient } from "../utils/trpc";
import { CONTRACT_ADDRESS, MINESWEEPER_STATE_ABI } from "../lib/wagmi";

interface PublishOnchainProps {
  gameId: string;
  xp: number;
  isVictory: boolean;
  /** Fires once when the publish tx is confirmed — parent can switch to post-publish layout. */
  onPublishConfirmed?: () => void;
}

function getPublishErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Error: failed updating the score onchain!";
  }

  const message =
    "message" in err && typeof err.message === "string"
      ? err.message.toLowerCase()
      : "";

  const shortMessage =
    "shortMessage" in err && typeof err.shortMessage === "string"
      ? err.shortMessage.toLowerCase()
      : "";

  const details =
    "details" in err && typeof err.details === "string"
      ? err.details.toLowerCase()
      : "";

  const combined = `${message} ${shortMessage} ${details}`;
  const isUserRejected =
    combined.includes("user rejected") ||
    combined.includes("user denied") ||
    combined.includes("rejected the request") ||
    combined.includes("request rejected") ||
    combined.includes("action_rejected");

  if (isUserRejected) {
    return "Error: failed updating the score onchain!";
  }

  return "Error: failed updating the score onchain!";
}

function PublishOnchainInner({
  gameId,
  xp,
  isVictory,
  onPublishConfirmed,
}: PublishOnchainProps) {
  const { address, isConnected, chainId: connectedChainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const primaryConnector = useMemo(
    () => connectors.find((c) => c.ready) ?? connectors[0],
    [connectors],
  );
  const {
    writeContract,
    data: txHash,
    isPending: isSending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const publishNotifiedRef = useRef(false);
  useEffect(() => {
    if (!isConfirmed || publishNotifiedRef.current) return;
    publishNotifiedRef.current = true;
    onPublishConfirmed?.();
  }, [isConfirmed, onPublishConfirmed]);

  const [isFetchingPayload, setIsFetchingPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!address) return;
    setError(null);
    setIsFetchingPayload(true);
    try {
      const payload = await trpcClient.game.getOnchainPayload.mutate({
        gameId,
        playerAddress: address,
      });
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: MINESWEEPER_STATE_ABI,
        functionName: "publishResult",
        args: [
          payload.gameId as `0x${string}`,
          BigInt(payload.xpEarned),
          payload.won,
          payload.signature as `0x${string}`,
        ],
      });
    } catch (err: unknown) {
      setError(getPublishErrorMessage(err));
    } finally {
      setIsFetchingPayload(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="onchain-result onchain-success-row" role="status">
        <span className="onchain-success-check" aria-hidden>
          ✓
        </span>
        <span className="onchain-success-published">Published.</span>
        {txHash ? (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="tx-link tx-link--explorer"
          >
            View on Explorer
          </a>
        ) : null}
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="onchain-connect">
        <p className="onchain-label mb-0">
          ZK proof verified — connect wallet to publish your result onchain and
          earn XP
        </p>
        {primaryConnector ? (
          <Button
            type="button"
            onClick={() => connect({ connector: primaryConnector })}
            disabled={isConnecting}
            className="connect-wallet-btn"
          >
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </Button>
        ) : (
          <p className="onchain-label">No wallet available</p>
        )}
      </div>
    );
  }

  if (connectedChainId !== base.id) {
    return (
      <div className="onchain-panel">
        <p className="onchain-label" style={{ marginBottom: "0.5rem" }}>
          Wrong network — please switch to Base to publish
        </p>
        <Button
          type="button"
          onClick={() => switchChain({ chainId: base.id })}
          disabled={isSwitching}
          className="switch-network-btn"
        >
          {isSwitching ? "Switching…" : "Switch to Base"}
        </Button>
      </div>
    );
  }

  return (
    <div className="onchain-panel">
      <Button
        type="button"
        onClick={handlePublish}
        disabled={isFetchingPayload || isSending || isConfirming}
        className="publish-btn"
      >
        {isFetchingPayload
          ? "Signing payload…"
          : isSending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Waiting for confirmation…"
              : `Publish ${xp} XP onchain${isVictory ? " 🏆" : ""}`}
      </Button>
      {(error || writeError) && (
        <p className="onchain-error">{error ?? getPublishErrorMessage(writeError)}</p>
      )}
    </div>
  );
}

export default function PublishOnchain(props: PublishOnchainProps) {
  return <PublishOnchainInner {...props} />;
}
