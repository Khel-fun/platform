// Resolves the art-direction assets in `packages/ui/assets/ui_elements` to
// fingerprinted URLs at build time. Mirrors the `import.meta.glob` pattern used
// in `components/playing-card.tsx`, kept in one place so screens share it.
//
// `import.meta` is untyped in this package (no vite/client types), so the glob
// is accessed dynamically; Vite resolves and fingerprints the URLs in the app.
const uiElements = (import.meta as unknown as { glob: Function }).glob(
  "../../assets/ui_elements/*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

/** URL for a file in `assets/ui_elements`, e.g. `uiElement("winner-game-avatar.png")`. */
export function uiElement(name: string): string | undefined {
  const entry = Object.entries(uiElements).find(([path]) =>
    path.endsWith(`/${name}`),
  );
  return entry?.[1];
}

// Named exports for the screens that consume them (typo in the source filename
// "home-sceen-mobile-bg.png" is preserved deliberately — that is the real name).
export const homeBgDesktop = uiElement("homescreen-desktop-bg.png");
export const homeBgMobile = uiElement("home-sceen-mobile-bg.png");
export const gameRoomBgDesktop = uiElement("game-room-desktop-bg.png");
export const gameRoomShadersDesktop = uiElement("game-room-desktop-shaders.png");
export const gameRoomBgMobile = uiElement("game-room-mobile-bg.png");
export const gameRoomShadersMobile = uiElement("game-room-mobile-shaders.png");
export const emptySlot = uiElement("game-card-empty-slot.png");
export const winnerAvatar = uiElement("winner-game-avatar.png");
export const loserAvatar = uiElement("loser-game-avatar.png");
