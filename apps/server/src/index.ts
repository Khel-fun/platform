import { createContext } from "@platform/api/context";
import { initProofWorker } from "@platform/api/proof-queue";
import { appRouter } from "@platform/api/routers/index";
import { env } from "@platform/env/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";

const app = express();

app.use(
  cors({
    origin: [env.CORS_ORIGIN, "http://localhost:3001"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "ngrok-skip-browser-warning", "x-trpc-source", "x-player-address"],
    credentials: true,
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

const server = app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

const wss = new WebSocketServer({ server });
const wssHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext,
});
console.log("WebSocket server attached at ws://localhost:3000");

const proofWorker = initProofWorker();

process.on("SIGTERM", async () => {
  console.log("[App] SIGTERM received, shutting down...");
  wssHandler.broadcastReconnectNotification();
  wss.close();
  await proofWorker.close();
  server.close();
});
