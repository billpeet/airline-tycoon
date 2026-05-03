import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { airport, game } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { OnboardingForm } from "./form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");

  const existing = await db.query.game.findFirst({
    where: eq(game.userId, session.user.id),
  });
  if (existing) redirect("/dashboard");

  // Pre-load a small list of suggested home airports — large airports across
  // the focus regions so the typeahead isn't shipping 2,887 rows of JSON.
  const suggested = await db
    .select({
      id: airport.id,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
    })
    .from(airport)
    .where(eq(airport.size, "large"));

  // Sort: focus countries first, then by iata
  const focusOrder = ["AU", "NZ", "US", "CA", "GB", "IE", "FR", "DE", "ES", "IT", "NL"];
  suggested.sort((a, b) => {
    const ai = focusOrder.indexOf(a.country);
    const bi = focusOrder.indexOf(b.country);
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return (a.iata ?? "").localeCompare(b.iata ?? "");
  });

  return (
    <main className="relative flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-ink/15 px-8 py-5">
        <span className="font-display text-[15px] uppercase tracking-[0.32em]">
          Airline · Tycoon
        </span>
        <span className="label-code text-ink-faint">Founding documents</span>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-8 py-12">
        <div className="rule-double pt-5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.36em] text-persimmon">
              ORG · 00
            </span>
            <span className="h-px flex-1 bg-ink/30" />
            <span className="label-code text-ink-faint">New entrant</span>
          </div>
          <h1 className="mt-3 font-display text-[56px] leading-[1.02] tracking-[-0.02em]">
            Found your airline.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Pick a name, a three-letter call-sign, and a home airport.
            You'll be granted $5M in founding capital and a single ATR 42-600
            ready for service. The world is yours to fly into.
          </p>
        </div>

        <OnboardingForm airports={suggested} />
      </section>
    </main>
  );
}
