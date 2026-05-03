import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

export type DB = BunSQLiteDatabase<typeof schema>;

let _db: DB | undefined;

function open(): DB {
  const url = process.env.DATABASE_URL ?? "./data/airline-tycoon.sqlite";
  mkdirSync(dirname(url), { recursive: true });

  const sqlite = new Database(url, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema });
}

// Proxy that opens the DB on first real access. Keeps Next.js's build-time
// page-data collection from contending on a SQLite lock just by importing.
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    if (!_db) _db = open();
    return Reflect.get(_db as object, prop);
  },
});
