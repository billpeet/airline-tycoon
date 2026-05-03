"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AirlineMark, AirlineWordmark } from "./airline-mark";
import { navigation } from "./nav-config";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "scroll-jet sticky top-0 flex h-dvh w-[260px] shrink-0 flex-col",
        "bg-sidebar text-sidebar-foreground",
        "border-r border-sidebar-border",
      )}
    >
      {/* Header lockup */}
      <Link
        href="/dashboard"
        className="group flex items-center gap-3 border-b border-sidebar-border px-5 py-5"
      >
        <span className="text-persimmon transition-transform group-hover:rotate-12">
          <AirlineMark className="h-9 w-9" />
        </span>
        <span className="flex flex-col gap-0.5">
          <AirlineWordmark className="text-sidebar-foreground" />
          <span className="label-code text-[9.5px] tracking-[0.35em] text-sidebar-foreground/55">
            EST. 2026 · OPS BOARD
          </span>
        </span>
      </Link>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((group, gi) => (
          <div key={group.group} className={cn(gi > 0 && "mt-7")}>
            <div className="flex items-center gap-3 px-2 pb-2">
              <span className="label-code text-sidebar-foreground/45">
                {group.group}
              </span>
              <span className="h-px flex-1 bg-sidebar-border" />
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-sm px-2 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      {/* Active beacon */}
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-sm",
                          active ? "bg-persimmon pulse-beacon" : "bg-transparent",
                        )}
                      />
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-persimmon" : "text-sidebar-foreground/65",
                        )}
                        strokeWidth={1.6}
                      />
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-sidebar-foreground/45 w-7">
                        {item.code}
                      </span>
                      <span className="font-sans">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer — version stamp like an aircraft data plate */}
      <div className="border-t border-sidebar-border px-5 py-4 text-[10px] text-sidebar-foreground/45">
        <div className="flex items-center justify-between font-mono uppercase tracking-[0.22em]">
          <span>Build · 0.0.1</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-hangar pulse-beacon" />
            Live
          </span>
        </div>
      </div>
    </aside>
  );
}
