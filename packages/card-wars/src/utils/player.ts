// Player identity for the web client.
//
// Identity is the connected wallet address (see `ConnectWallet` /
// `PlayerAddressSync`, which feed it in via `setPlayerAddress`). It is sent on
// HTTP requests via the `x-player-address` header and on the WebSocket via tRPC
// connectionParams (browsers can't set custom WS headers). When no wallet is
// connected this is `null` and identified procedures will reject.
//
// Addresses are stored lowercase so the value the client sends matches how the
// server persists it.

let currentAddress: string | null = null;

/** The connected wallet address (lowercased), or null when disconnected. */
export function getPlayerAddress(): string | null {
  return currentAddress;
}

/** Update the active identity. Called by the wallet sync bridge. */
export function setPlayerAddress(address: string | null): void {
  currentAddress = address ? address.toLowerCase() : null;
}
