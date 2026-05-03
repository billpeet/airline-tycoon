import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { airlineHub } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Returns the count of distinct real-world airlines with a hub at either
 * `from` or `to` airport. Used by the route configurator to preview the
 * competition penalty before opening.
 *
 *   GET /api/airports/competitors?from=LHR&to=CDG  →  { count: 6 }
 */
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ count: 0 }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  if (!from || !to) return NextResponse.json({ count: 0 });

  const rows = await db
    .select({ airlineId: airlineHub.airlineId })
    .from(airlineHub)
    .where(or(eq(airlineHub.airportId, from), eq(airlineHub.airportId, to)));
  const set = new Set(rows.map((r) => r.airlineId));
  return NextResponse.json({ count: set.size });
}
