import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export function PageHeader({
  code,
  title,
  description,
  meta,
  actions,
  className,
}: {
  code: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("rule-double pt-5", className)}>
      <div className="flex flex-col gap-5 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.36em] text-persimmon">
              {code}
            </span>
            <span className="h-px w-8 bg-ink/30" />
            {meta && <span className="label-code text-ink-faint">{meta}</span>}
          </div>
          <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em] text-ink md:text-[56px]">
            {title}
          </h1>
          {description && (
            <p className="max-w-xl text-[15px] leading-relaxed text-ink-soft">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
