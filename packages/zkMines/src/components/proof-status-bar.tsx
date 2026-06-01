import { useState, useEffect } from "react";

/** ZK proof UI — marquee loader while verifying; solid bar when terminal. */

export type ProofUiVariant = "pending" | "verified" | "failed";

/** Single source of truth for pending vs done (marquee vs solid bar, lobby actions). */
export function getProofUiVariant(proofStatus: string | null | undefined): ProofUiVariant {
  if (!proofStatus) return "pending";
  const s = proofStatus.toUpperCase();
  switch (s) {
    case "QUEUED":
    case "VALID":
    case "AGGREGATION_PENDING":
      return "pending";
    case "SUBMITTED":
    case "INCLUDED_IN_BLOCK":
    case "FINALIZED":
    case "AGGREGATED":
      return "verified";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

function proofProgress(
  proofStatus: string | null | undefined,
  isVerifyingPhase: boolean,
): {
  variant: ProofUiVariant;
  caption: string;
  showCheck: boolean;
} {
  const variant = getProofUiVariant(proofStatus);
  if (variant === "pending") {
    return {
      variant,
      caption: isVerifyingPhase ? "Verifying ZK Proofs..." : "Generating ZK Proofs...",
      showCheck: false,
    };
  }
  if (variant === "failed") {
    return { variant, caption: "Verification failed", showCheck: false };
  }
  return { variant, caption: "Proofs Verified", showCheck: true };
}

interface ProofStatusBarProps {
  proofStatus: string | null;
  /** Show after a finished game while proof pipeline runs or completes. */
  visible: boolean;
}

export default function ProofStatusBar({ proofStatus, visible }: ProofStatusBarProps) {
  const [isVerifyingPhase, setIsVerifyingPhase] = useState(false);

  useEffect(() => {
    if (visible && !isVerifyingPhase) {
      const timer = setTimeout(() => {
        setIsVerifyingPhase(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
    if (!visible) {
      setIsVerifyingPhase(false);
    }
  }, [visible, isVerifyingPhase]);

  if (!visible) return null;
  const proof = proofProgress(proofStatus, isVerifyingPhase);


  return (
    <div className="proof-row proof-row--below-board" id="proof-status">
      <div
        className={
          proof.variant === "pending" ? "proof-track proof-track--marquee" : "proof-track"
        }
      >
        {proof.variant === "pending" ? (
          <div className="proof-marquee-bar" aria-hidden />
        ) : (
          <div className={`proof-fill proof-fill--${proof.variant}`} style={{ width: "100%" }} />
        )}
      </div>
      <div
        className={`proof-caption ${
          proof.variant === "verified"
            ? "proof-caption--verified"
            : proof.variant === "failed"
              ? "proof-caption--failed"
              : "proof-caption--pending"
        }`}
      >
        {proof.showCheck ? (
          <span className="proof-check" aria-hidden>
            ✓
          </span>
        ) : null}
        {proof.caption}
      </div>
    </div>
  );
}
