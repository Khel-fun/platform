import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),
    CORS_ORIGIN: z.url(),
    REDIS_URL: z.url().default("redis://localhost:6379"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Kurier poller tuning (all optional, with sane defaults)
    KURIER_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(120000),
    KURIER_SYNC_CONCURRENCY: z.coerce.number().int().positive().default(8),
    KURIER_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
    KURIER_URL: z.url().optional(),
    KURIER_API: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
