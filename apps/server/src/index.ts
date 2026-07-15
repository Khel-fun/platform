import { createContext } from "@platform/api/context";
import { appRouter } from "@platform/api/routers/index";
import { env } from "@platform/env/server";
import { initKurierPoller } from "@platform/api/lib/kurier_poller"
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

app.listen(3000, async() => {
  const kurierWorker = await initKurierPoller();
  console.log("Server is running on http://localhost:3000");

  process.on("SIGTERM", async () => {
      console.log("[App] SIGTERM received, shutting down workers...");
      await Promise.all([kurierWorker.close()]);
      process.exit(0);
    });
});
