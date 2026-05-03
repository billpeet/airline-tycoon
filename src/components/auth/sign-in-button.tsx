"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { signIn } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export function SignInButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signIn.social({ provider: "google", callbackURL: "/dashboard" });
      }}
      className={cn(
        "group relative inline-flex items-center gap-3 border border-ink bg-ink px-6 py-3.5",
        "text-[12px] font-medium uppercase tracking-[0.22em] text-paper",
        "shadow-[3px_3px_0_0_var(--color-persimmon)]",
        "transition-all duration-150",
        "hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--color-persimmon)]",
        "active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--color-persimmon)]",
        "disabled:cursor-progress disabled:opacity-60",
        className,
      )}
    >
      <span className="font-mono text-[10px] tracking-[0.18em] text-persimmon">
        FLY/01
      </span>
      <span>{pending ? "Boarding…" : "Sign in with Google"}</span>
      <ArrowUpRight
        className={cn(
          "size-3.5 transition-transform",
          "group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
        )}
      />
    </button>
  );
}
