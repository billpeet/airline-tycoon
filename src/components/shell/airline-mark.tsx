import { cn } from "@/lib/utils";

/**
 * Airline Tycoon house mark — a stylised compass + sweep, evoking a
 * mid-century airline livery insignia. Pure inline SVG so it inherits
 * currentColor.
 */
export function AirlineMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
    >
      <circle cx="32" cy="32" r="28" />
      <path d="M32 6 L32 58" strokeWidth={1} opacity={0.5} />
      <path d="M6 32 L58 32" strokeWidth={1} opacity={0.5} />
      {/* Wing sweep */}
      <path
        d="M14 42 Q32 18 50 28 L46 32 L48 36 L18 46 Z"
        fill="currentColor"
        stroke="none"
      />
      {/* Tail dot */}
      <circle cx="32" cy="32" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AirlineWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[15px] uppercase tracking-[0.32em] leading-none",
        className,
      )}
    >
      Airline · Tycoon
    </span>
  );
}
