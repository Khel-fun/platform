import { createLogger } from "@platform/config/logger";
import { CircuitKind } from "../src/types";
import { generateProof, verifyProof } from "../src";

const log = createLogger("proof-actions");

export async function generateShuffleProof(
  seed: string,
  shuffled_deck: string[]
): Promise<{ proofHex: string; publicInputs: string[] }> {
  log.info("initializing proof gen...");
  const { proofHex, publicInputs } = await generateProof(
    CircuitKind.SHUFFLE,
    {seed, shuffled_deck}
  );
  log.info("proof successfully generated");
  return { proofHex, publicInputs };
}

export async function submitProof(
  circuitKind: CircuitKind,
  proofHex: string,
  publicInputs: string[]
): Promise<{ jobId: string; optimisticVerify: string }> {
  log.info("verifying & submiting proof to Kurier");
  const { jobId, optimisticVerify } = await verifyProof(
    circuitKind,
    proofHex,
    publicInputs,
  );
   log.info("proof verified and submitted to Kurier", { jobId, optimisticVerify });
   return { jobId, optimisticVerify };
}
