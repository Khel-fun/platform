import { cn } from "../lib/utils";

// Bundle the card-face assets that live alongside this package. `import.meta`
// is untyped here (no vite/client types in this package's tsconfig), so the
// glob is accessed dynamically; Vite resolves and fingerprints the URLs at
// build time in the consuming app.
const assets = (import.meta as unknown as { glob: Function }).glob(
  "../../assets/card_faces/*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function assetByName(name: string): string | undefined {
  const entry = Object.entries(assets).find(([path]) => path.endsWith(`/${name}`));
  return entry?.[1];
}

const COVER = assetByName("card_cover.png");

/** Card number 0–51 maps to the zero-padded face asset (e.g. 7 -> 07.png). */
function faceFor(cardNumber: number): string | undefined {
  return assetByName(`${String(cardNumber).padStart(2, "0")}.png`);
}

export type PlayingCardProps = {
  /** Card number 0–51. Ignored when `faceDown`. */
  number?: number;
  /** Render the back of the card (opponent / concealed). */
  faceDown?: boolean;
  /** Lift + ring to indicate the player's current pick. */
  selected?: boolean;
  /** Dim and block interaction (already played / not your turn). */
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export function PlayingCard({
  number,
  faceDown,
  selected,
  disabled,
  onClick,
  className,
}: PlayingCardProps) {
  const src = faceDown || number === undefined ? COVER : faceFor(number);
  const interactive = Boolean(onClick) && !disabled;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      className={cn(
        "relative aspect-[5/7] w-20 shrink-0 overflow-hidden rounded-lg border bg-card shadow transition-transform",
        interactive && "cursor-pointer hover:-translate-y-2 hover:shadow-lg",
        selected && "-translate-y-3 ring-2 ring-primary",
        disabled && !faceDown && "opacity-40",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={faceDown ? "Hidden card" : `Card ${number}`}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs">
          {number}
        </span>
      )}
    </button>
  );
}
