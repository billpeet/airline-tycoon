import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "./data/airline-tycoon.sqlite";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
