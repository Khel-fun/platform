import { createConfig, http } from "wagmi";
import { baseSepolia, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { env } from "@platform/env/web";

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http()
  },
});

export const CONTRACT_ADDRESS = env.VITE_CONTRACT_ADDRESS as `0x${string}`;

export const MINESWEEPER_STATE_ABI = [
  {
    name: "publishResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "bytes32" },
      { name: "xpEarned", type: "uint256" },
      { name: "won", type: "bool" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getPlayerStats",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "totalXP", type: "uint256" },
      { name: "gamesPlayed", type: "uint256" },
      { name: "gamesWon", type: "uint256" },
    ],
  },
  {
    name: "GameResultPublished",
    type: "event",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "gameId", type: "bytes32", indexed: true },
      { name: "xpEarned", type: "uint256", indexed: false },
      { name: "won", type: "bool", indexed: false },
    ],
  },
] as const;
