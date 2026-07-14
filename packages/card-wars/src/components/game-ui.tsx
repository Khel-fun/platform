// Shared presentational pieces for the art-directed Card Wars screens.
import { cn } from "@platform/ui/lib/utils";

/**
 * Green "frosted" pill — the primary CTA used for connect-wallet, PLAY and home.
 * Exposed as a class string so it can also style a base-ui dropdown trigger.
 */
export const pillButtonClass =
  "cw-pill-rim inline-flex cursor-pointer items-center justify-center gap-2 rounded-[36px] " +
  "min-h-[62px] border-0 bg-[#0C4F38]/48 px-[36px] py-[20px] font-button text-[20px] font-normal " +
  "leading-[22px] text-center text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors " +
  "hover:bg-[#0C4F38]/56 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 " +
  "disabled:pointer-events-none disabled:opacity-60";

/** Pink→orange gradient pill for the "Submit Game Onchain" fallback CTA. */
export const gradientButtonClass =
  "inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center rounded-[8px] " +
  "bg-gradient-to-r from-[#ff1478] via-[#ff3472] to-[#ff9b2f] px-6 py-2 " +
  "font-ui text-[14px] font-bold leading-[18px] text-white shadow-lg " +
  "transition-opacity hover:opacity-95 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-pink-400/60 " +
  "disabled:pointer-events-none disabled:opacity-60";

/** "CARD WARS" wordmark in the Tomorrow display face. */
export function CardWarsTitle({
  oneLine,
  className,
}: {
  oneLine?: boolean;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "font-display font-extrabold uppercase leading-[0.85] tracking-tight text-white",
        className,
      )}
    >
      {oneLine ? (
        "Card Wars"
      ) : (
        <>
          Card
          <br />
          Wars
        </>
      )}
    </h1>
  );
}

/** Truncates `0x71fb…cd9k0a` → `0x71fb….9k0a` to match the reference previews. */
export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}….${address.slice(-4)}`;
}
