import { NextResponse } from "next/server";
import { or, like, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { airport } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const upper = q.toUpperCase();
  const like1 = `%${q}%`;

  // Fast prefix on IATA, fuzzy on city/name. Country exact match if 2 chars.
  const rows = await db
    .select()
    .from(airport)
    .where(
      or(
        eq(airport.iata, upper),
        eq(airport.country, upper),
        like(airport.city, like1),
        like(airport.name, like1),
      ),
    )
    .limit(20);

  return NextResponse.json(rows);
}
