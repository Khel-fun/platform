/// <reference path="../types/socket-io-client.d.ts" />

import { io, type Socket } from "socket.io-client";

import { env } from "@platform/env/web";

let socket: Socket | null = null;

export function getCardWarsBackendUrl() {
  return env.VITE_CARD_WARS_BACKEND_URL ?? "http://localhost:4000";
}

export function getCardWarsSocket() {
  if (!socket) {
    socket = io(getCardWarsBackendUrl(), {
      transports: ["websocket"],
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      },
    });
  }

  return socket;
}
