import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

/**
 * BoardingCard — a paper card framed like a boarding-pass section.
 * Uses notched stubs at the top corners (via radial-gradient mask) to
 * sell the perforation feel without literal cuts.
 */
export function BoardingCard({
  className,
  children,
  stub,
}: {
  className?: string;
  children: ReactNode;
  stub?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "card-pass flex flex-col bg-paper",
        "shadow-[0_1px_0_0_var(--color-ink),_0_4px_0_-2px_var(--color-ink)]",
        className,
      )}
    >
      {stub && (
        <div className="flex items-stretch border-b border-dashed border-ink/40">
          {stub}
        </div>
      )}
      {children}
    </article>
  );
}

export function BoardingCardEyebrow({
  code,
  title,
  meta,
  className,
}: {
  code: string;
  title?: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-ink/15 bg-paper-deep px-4 py-2",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-persimmon">
          {code}
        </span>
        {title && (
          <span className="label-code text-ink-soft">{title}</span>
        )}
      </div>
      {meta && <div className="label-code text-ink-faint">{meta}</div>}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  className?: string;
}) {
  const toneText = {
    neutral: "text-ink",
    positive: "text-hangar",
    negative: "text-beacon",
    warning: "text-runway",
  }[tone];

  return (
    <div className={cn("flex flex-col gap-1.5 px-4 py-4", className)}>
      <span className="label-eyebrow">{label}</span>
      <span className={cn("num-tabular text-[28px] font-medium leading-none", toneText)}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </div>
  );
}
