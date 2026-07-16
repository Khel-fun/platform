import { createElement, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { SpeedOLightGame } from "./SpeedOLightGame";
import trpcRuntime from "./utils/trpc";

export function SpeedOLightProviders({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: trpcRuntime.queryClient }, children);
}

export { SpeedOLightGame };
