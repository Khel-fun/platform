import { createContext } from "@platform/api/context";
import { appRouter } from "@platform/api/routers/index";
import { env } from "@platform/env/server";
import {
  initKurierPoller,
  shutdownKurierPoller,
} from "@platform/api/lib/kurier_poller";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

// Health check for the deploy script (scripts/deploy-backend.sh) — must return
// 2xx so `curl -fsS http://localhost:3000/health` succeeds post-deploy.
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.listen(3000, async () => {
  console.log("Server is running on http://localhost:3000");

  try {
    await initKurierPoller();
    console.log("[App] Kurier poller started");
  } catch (err) {
    // Don't let a poller failure (e.g. Redis down at boot) silently no-op:
    // the HTTP server stays up, but surface the error loudly.
    console.error("[App] Failed to start Kurier poller:", err);
  }
});

async function gracefulShutdown(signal: string) {
  console.log(`[App] ${signal} received, shutting down workers...`);
  try {
    await shutdownKurierPoller();
  } catch (err) {
    console.error("[App] Error during shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
