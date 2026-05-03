import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

// Throw at request time (not module load) so build/migrate work without all envs set.
const env = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  return v;
};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-not-for-production",
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  socialProviders: {
    google: {
      get clientId() {
        return env("GOOGLE_CLIENT_ID");
      },
      get clientSecret() {
        return env("GOOGLE_CLIENT_SECRET");
      },
    },
  },
});

export type Auth = typeof auth;
