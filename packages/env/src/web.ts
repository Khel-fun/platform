import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // khel
    VITE_SERVER_URL: z.url().optional(),
    VITE_WALLETCONNECT_PROJECT_ID: z.string().optional(),


    // card-wars
    VITE_CARD_WARS_BACKEND_URL: z.url().optional(),
    VITE_CARD_WARS_CHAIN_ID: z.coerce.number().optional(),
    VITE_CARD_WARS_CONTRACT_ADDRESS: z.string().optional(),

    // zk-Mines
    VITE_ZK_MINES_BACKEND_URL: z.url().optional(),
    VITE_ZK_MINES_CHAIN_ID: z.coerce.number().optional(),
    VITE_ZK_MINES_CONTRACT_ADDRESS: z.string().optional(),

    // speed-o-light
    VITE_SPEED_O_LIGHT_BACKEND_URL: z.url().optional(),
    VITE_SPEED_O_LIGHT_CHAIN_ID: z.coerce.number().optional(),
    VITE_SPEED_O_LIGHT_CONTRACT_ADDRESS: z.string().optional(),

  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
