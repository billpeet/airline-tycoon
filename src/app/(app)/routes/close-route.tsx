"use client";

import { useTransition } from "react";
import { closeRoute } from "@/app/actions/game";
import { useRouter } from "next/navigation";

export function CloseRouteButton({ routeId }: { routeId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Close this route?")) return;
        start(async () => {
          await closeRoute(routeId);
          router.refresh();
        });
      }}
      className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint hover:text-beacon"
    >
      {pending ? "…" : "Close"}
    </button>
  );
}
