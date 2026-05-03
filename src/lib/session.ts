import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/server";
import { db } from "@/db/client";
import { game, type Game } from "@/db/schema";
import { ensureSimUpToDate, type CatchupResult } from "@/sim/catchup";

export async function getSessionUser() {
  return auth.api.getSession({ headers: await headers() });
}

/** Returns the user's active game (or null) and ensures the sim is current. */
export async function getActiveGame(): Promise<{
  user: { id: string; name: string; email: string; image: string | null };
  game: Game | null;
  catchup: CatchupResult | null;
} | null> {
  const session = await getSessionUser();
  if (!session) return null;

  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) {
    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      },
      game: null,
      catchup: null,
    };
  }

  const catchup = await ensureSimUpToDate(g.id);
  // Re-read after catch-up so callers see fresh totals.
  const refreshed =
    catchup.ranDays > 0
      ? (await db.query.game.findFirst({ where: eq(game.id, g.id) })) ?? g
      : g;

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
    },
    game: refreshed,
    catchup,
  };
}
