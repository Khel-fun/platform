// GameRegistry client: backend signing, status reads, and tx submission.
//
// The backend signs each finished session's `Result` with SIGNING_PRIVATE_KEY
// (the contract's trusted signer) and submits `finalizeSession` itself. The
// same signature is valid from any sender, so the player fallback reuses it.

import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { env } from "@platform/env/server";
import { createLogger } from "@platform/config/logger";
import { gameRegistryAbi } from "./abi";
import { type GameResult, RESULT_TYPES } from "./result";

const log = createLogger("onchain-registry");

/** Whether on-chain finalization is configured (a registry address is set). */
export function isOnchainConfigured(): boolean {
  return Boolean(env.GAME_REGISTRY_ADDRESS);
}

function normalizedPrivateKey(): Hex {
  const key = env.SIGNING_PRIVATE_KEY.trim();
  return (key.startsWith("0x") ? key : `0x${key}`) as Hex;
}

function resolveChain(chainId: number) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  throw new Error(`[ONCHAIN] Unsupported GAME_REGISTRY_CHAIN_ID ${chainId}`);
}

// Let viem infer the precise client types — explicit annotations fight its
// generics and break method signatures.
function createClients() {
  const address = env.GAME_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error("[ONCHAIN] GAME_REGISTRY_ADDRESS is not configured");
  }
  const chain = resolveChain(env.GAME_REGISTRY_CHAIN_ID);
  const account = privateKeyToAccount(normalizedPrivateKey());
  // `http(undefined)` uses the chain's default public RPC.
  const transport = http(env.RPC_URL);

  return {
    address: address as Address,
    chain,
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };
}

let cached: ReturnType<typeof createClients> | null = null;

function clients() {
  if (!cached) cached = createClients();
  return cached;
}

/** The backend signer's address (must equal the contract's `signer()`). */
export function getSignerAddress(): Address {
  return clients().account.address;
}

/** Registry address + chain id, for handing to the player fallback. */
export function getRegistryConfig(): { address: Address; chainId: number } {
  const c = clients();
  return { address: c.address, chainId: c.chain.id };
}

/** The EIP-712 domain — binds signatures to this contract on this chain. */
export function buildDomain() {
  const c = clients();
  return {
    name: "GameRegistry",
    version: "1",
    chainId: c.chain.id,
    verifyingContract: c.address,
  } as const;
}

/** Sign a `Result` with the backend signer key (deterministic per payload). */
export async function signResult(result: GameResult): Promise<Hex> {
  return clients().account.signTypedData({
    domain: buildDomain(),
    types: RESULT_TYPES,
    primaryType: "Result",
    message: result,
  });
}

/** Read a session's on-chain status (0 = None, 1 = Finalized). */
export async function getSessionStatus(sessionId: Hex): Promise<number> {
  const c = clients();
  const status = await c.publicClient.readContract({
    address: c.address,
    abi: gameRegistryAbi,
    functionName: "sessionStatus",
    args: [sessionId],
  });
  return Number(status);
}

/** Submit `finalizeSession` and wait for the receipt. Returns the tx hash. */
export async function submitFinalize(
  result: GameResult,
  signature: Hex,
): Promise<Hex> {
  const c = clients();
  const hash = await c.walletClient.writeContract({
    address: c.address,
    abi: gameRegistryAbi,
    functionName: "finalizeSession",
    args: [result, signature],
    account: c.account,
    chain: c.chain,
  });
  log.info(`[ONCHAIN] finalizeSession submitted: ${hash}`);

  const receipt = await c.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`[ONCHAIN] finalizeSession reverted (tx ${hash})`);
  }
  return hash;
}

/** True when an error is the contract's `SessionAlreadyFinalized` revert. */
export function isAlreadyFinalizedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("SessionAlreadyFinalized");
}
