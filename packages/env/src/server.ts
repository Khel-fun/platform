import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    KURIER_URL: z.url(),
    KURIER_API: z.string().min(1),
    KURIER_CHAIN_ID: z.coerce.number().int().positive(),
    SIGNING_PRIVATE_KEY: z.string().min(1),
    SIGNING_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    REDIS_URL: z.url().default("redis://localhost:6379"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    GAME_REGISTRY_ADDRESS: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    GAME_REGISTRY_CHAIN_ID: z.coerce.number().int().positive().default(84532),
    RPC_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
