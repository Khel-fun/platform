declare module "socket.io-client" {
  export type Socket = {
    connected: boolean;
    connect: () => void;
    emit: (event: string, payload?: unknown) => void;
    on: (event: string, listener: (...args: any[]) => void) => void;
    off: (event: string, listener: (...args: any[]) => void) => void;
  };

  export function io(
    url: string,
    options?: {
      transports?: string[];
      extraHeaders?: Record<string, string>;
    },
  ): Socket;
}
