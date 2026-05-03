# Airline Tycoon

An idle airline-management tycoon game. See [`SPEC.md`](./SPEC.md) for the full design.

**Stack:** Bun · Next.js (App Router) · Tailwind · shadcn/ui · Three.js · Drizzle ORM + SQLite · Better Auth (Google OAuth) · Docker / Dokploy.

## Local development

Prerequisites: [Bun](https://bun.com/) ≥ 1.3.

```bash
# Install deps
bun install

# Configure environment
cp .env.example .env.local
# then fill in BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Apply DB migrations (creates ./data/airline-tycoon.sqlite)
bun run db:migrate

# Start the dev server
bun run dev
```

Visit <http://localhost:3000>.

### Google OAuth setup

1. Create OAuth credentials at <https://console.cloud.google.com/apis/credentials> (type: Web application).
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
3. Paste the Client ID / Secret into `.env.local`.

### Useful scripts

| Script | What it does |
|---|---|
| `bun run dev` | Next.js dev server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Run the production build |
| `bun run db:generate` | Generate a new Drizzle migration from the schema |
| `bun run db:migrate` | Apply pending migrations to the SQLite file |
| `bun run db:seed` | Idempotently upsert the reference data (airports, aircraft, airlines, hubs) |
| `bun run fetch:airports` | Re-pull the OurAirports CSV → `src/data/seeds/airports.json` |
| `bun run lint` | ESLint |

## Reference data & sources

All gameplay reference data is committed to the repo as JSON in `src/data/seeds/`:

- **`airports.json`** — sourced from [**OurAirports**](https://ourairports.com/data/) (David Megginson, public domain). Filtered to large airports globally + medium airports in our focus regions (AU/NZ + North America + Europe). Re-fetch any time with `bun run fetch:airports`.
- **`aircraft.json`** — hand-curated from manufacturer published specifications (Boeing, Airbus, Embraer, ATR, De Havilland Canada).
- **`airlines.json`** — hand-curated focused list (~50 carriers): every meaningful AU/NZ, NA and EU carrier plus key global hubs. Includes hubs (with priority), alliance, fleet size and the per-carrier AI behaviour parameters used by the simulation.

`bun run db:seed` upserts all of the above; the Docker entrypoint runs it on every boot so deploys self-heal.

## Docker / Dokploy

```bash
docker compose up --build
```

The SQLite database lives in the `airline-tycoon-data` named volume; nightly backups land in `airline-tycoon-backups`.

## Project layout

```
src/
  app/              Next.js App Router pages & route handlers
  db/               Drizzle schema, client, migrations
  lib/auth/         Better Auth server + client
  components/       shadcn/ui-based components
```

## Status

Phase 0 (foundation) — see the checklist in [`SPEC.md`](./SPEC.md#11-phased-build-plan).
