# Airline Tycoon — Game Specification

## 1. Vision

A long-form idle tycoon game in which the player builds a fictional airline from a single-aircraft regional charter into a global carrier, competing inside the real-world airline industry against simulated versions of Delta, Lufthansa, Ryanair, Emirates, and friends. Sessions are short and frequent; meaningful progress accrues offline; the dopamine hit lives in the "newspaper summary" on return and in the slow, compounding strategic decisions about fleet, network, and finance.

The game is intended to be played over **weeks to months**, with **prestige/merger resets** providing a fresh start with permanent bonuses to keep long-term play from going stale.

## 2. Core Gameplay Loop

**Per-session loop (5–20 min)**
1. Read the newspaper summary of what happened while offline.
2. Resolve any pending interactive events (fleet offers, regulatory choices, crew disputes).
3. Adjust under-performing routes (fares, frequency, aircraft) using the demand/competition panel.
4. Buy/lease new aircraft, open new routes, allocate gate slots.
5. Spend tech-tree points on the next unlock.
6. Optionally crank up the time-acceleration slider and watch a few in-game weeks tick by on the globe.

**Macro loop (weeks)**
- Tiny charter → regional → continental → intercontinental → global → merger/prestige.
- Each tier opens new aircraft classes, finance instruments, and tech-tree branches.

## 3. Time Model

| State | Rate |
|---|---|
| Baseline (connected, no acceleration) | 1 real hour = 1 game day |
| Connected w/ acceleration | Up to 8× baseline (tech-tree unlockable: 2×, 4×, 8×) |
| Offline | 0.5× baseline, capped at 7 real days of accumulated time per session |

Rationale: rewards engagement without punishing absence. The 7-day cap prevents a returning player from being overwhelmed and avoids degenerate "leave it for a year" exploits.

## 4. Game Systems

### 4.1 Fleet & Aircraft

- **Real aircraft families**, sourced into DB: A220, A320 family, A330, A350, A380, 737 family, 747, 777, 787, ATR-72, Embraer E-Jets, etc.
- Per-aircraft attributes (in DB, not code):
  - Range (km), passenger capacity (configurable mix of cabins), cargo capacity, cruise speed, fuel burn, list price, lease rate, maintenance cost/cycle, crew requirement, noise/emissions class.
- **Acquisition modes:**
  - **Buy outright** — capex hit, full asset on balance sheet.
  - **Finance** — loan against the airframe.
  - **Operating lease** — opex only, no asset, easier to flex.
  - **Used market** — cheaper, higher maintenance, occasional surprise grounding events.
- **Aircraft lifecycle:** delivery delays for new orders, maintenance cycles (C/D checks), eventual retirement.

### 4.2 Routes & Network

- Real airports, sourced into DB (start with top ~1500 by traffic; expandable).
- **Route definition:** origin, destination, frequency (flights/week), aircraft assigned, fare per cabin class.
- **Demand model** (visible to the player when configuring):
  - Base demand from city-pair size, business/leisure mix, seasonality.
  - Modifiers: competitor presence, your fare vs market, your reputation, codeshare bonuses, hub connectivity.
- **Hub-and-spoke bonus:** passengers connecting through a player hub generate revenue on both legs and improve hub utilization metrics.
- **Slot constraints** at major airports — player must acquire slots (capital expense + sometimes tech-tree gated).
- **Competition feedback:** opening a route against an entrenched competitor triggers their AI response (fare cut, frequency increase) — visible in the planning UI.

### 4.3 Finance

Tiered availability via tech tree:
- **Tier 1:** Cash, bank loans (variable rate, collateralized).
- **Tier 2:** Operating leases, revolving credit facility.
- **Tier 3:** Corporate bonds (fixed-rate, longer tenor).
- **Tier 4:** IPO — issue equity, dilutes player's "ownership %" stat (cosmetic but tracked for prestige scoring).
- **Tier 5:** Fuel hedging contracts (lock fuel cost for N quarters; a real bet against the fuel-price RNG).

Balance sheet, P&L, and cash-flow statement all surfaced in a finance dashboard. **Cashflow** is the constant pressure — going cash-negative without a credit line triggers bankruptcy warnings, then forced asset sales, then game-over (rolled into prestige).

### 4.4 Staff & Operations

- **Aggregate staffing** (not individual): pilots, cabin crew, ground crew, mechanics, admin.
- Each route/aircraft has a staffing demand; under-staffing causes cancellations and reputation hits.
- **Training pipeline** — pilots especially have lead time; can't just hire 200 A350 captains overnight.
- **Maintenance ops:** must contract or build hangars at hub airports.

### 4.5 Reputation & Brand

- Single 0–100 reputation score per region, with sub-scores (on-time performance, safety, comfort, value).
- Improves with: on-time flights, satisfied passengers, marketing spend, premium aircraft.
- Decays with: cancellations, incidents (random events), customer-satisfaction-lowering cost cuts.
- **Effects:** unlocks slot allocations at premium hubs, attracts codeshare partners, allows higher fare premiums.

### 4.6 Tech Tree

Branching tree, point-based (points awarded by milestones — passenger count, route count, profit threshold, prestige). Sample branches:

- **Operations** — speed-acceleration tiers, maintenance efficiency, crew training speed.
- **Fleet** — unlock aircraft families (regional → narrowbody → widebody → superjumbo → next-gen).
- **Network** — unlock regions (Domestic → Continental → Transatlantic → Asia-Pacific → Africa → Polar routes).
- **Finance** — unlock instruments (loans → leases → bonds → IPO → hedging).
- **Specialization** (mutually exclusive choices, encourage replays):
  - **Low-cost carrier** — fare-elasticity bonuses, single-class only, faster turn times.
  - **Premium full-service** — reputation bonuses, premium-cabin demand boost.
  - **Cargo specialist** — unlock cargo aircraft and freighter conversions.
  - **Charter/holiday** — seasonal route bonuses, leisure-demand boost.

### 4.7 Random Events

Stored as DB records with conditions, weights, and effect templates. Two flavors:

**Pure-consequence:** "Jet fuel up 12% for 4 weeks." "Air traffic controller strike at LHR — your CDG–LHR cancelled for 3 days."

**Interactive choice:** "Boeing offers you a launch-customer slot on the 797 — commit $200M deposit for delivery in 18 months?" "Government subsidy available for serving regional airport X — accept 5-year route obligation?"

Categories: macroeconomic (fuel, FX, interest rates, recessions), geopolitical (airspace closures, sanctions, new bilateral agreements), technological (new aircraft launches, biofuel mandates), operational (strikes, weather seasons, incidents), and opportunity (codeshare offers, slot auctions, government tenders).

### 4.8 Merger / Prestige

When the player hits a defined "global empire" threshold (or chooses to retire early for partial bonus), they trigger a **merger** that resets the game with permanent bonuses on a new run:

- Persistent currency: "Industry Reputation" — purchases starting cash boosts, faster tech unlocks, starting-region choice, free starter aircraft, executive perks (reduced cashflow volatility), etc.
- Each prestige tweaks the random-event weighting (harder events unlock for veterans).

## 5. Competitive Landscape

Real-world airlines are AI-controlled actors with:
- Real fleet rosters and route maps as starting state (loaded from DB; refreshable).
- Behavior parameters: aggression on route entry, fare strategy, expansion appetite, financial health.
- They open and close routes, buy aircraft, suffer their own random events.
- They occasionally offer codeshare/alliance deals to the player based on reputation and route complementarity.

Three global alliances (Star, OneWorld, SkyTeam) exist as DB entities; player can be invited to join after meeting size + reputation thresholds.

## 6. World Visualization (3D Globe)

- **Three.js** rotating Earth.
- **Layers** (toggleable):
  - Player route arcs (color-coded by profitability).
  - Competitor route density (heatmap).
  - Live "in-flight" aircraft markers moving along arcs (sampled — not 1:1 with sim).
  - Demand heatmap by city.
- **Performance budget:** must remain smooth (≥30fps) on a mid-range laptop with up to ~500 player routes drawn. Use instanced meshes for aircraft markers, line geometry for arcs. Aircraft animation is decorative — NOT the source of truth for the simulation.

## 7. UI / UX

Desktop-first (the data density wants screen real estate); a responsive mobile dashboard ships in a later phase.

**Primary screens:**
- **Operations Centre** (`/dashboard`) — today's board, alerts, fleet status, ledger.
- **Globe** (`/globe`) — Three.js Earth with route arcs, demand heatmap, competitor density.
- **Fleet** (`/fleet`) — table of aircraft, individual aircraft drilldown (utilisation, maintenance, P&L).
- **Routes** (`/routes`) — table + map filter, per-route configurator.
- **Finance** (`/finance`) — balance sheet, P&L, cashflow, financing actions.
- **Tech Tree** (`/tech`) — branching graph with unlock costs.
- **Events** (`/events`) — feed of pending decisions and recent consequences.
- **Newsroom** (`/news`) — post-offline morning-paper summary feed.

### 7.1 Design System — "Jet-Age Editorial"

A deliberate aesthetic direction: equal parts 1960s airline poster (Pan Am / BOAC / TWA), Vignelli timetable discipline, and modern operations-room precision. **One saturated colour at a time** — the rest is tonal cream and ink.

**Palette** (CSS custom properties, surfaced as Tailwind 4 utilities — `bg-paper`, `text-ink`, `bg-persimmon`, etc.):

| Token | Role | OKLCH |
|---|---|---|
| `--color-paper` / `paper-deep` / `paper-edge` | Cream canvas, panel surfaces, rules | warm cream |
| `--color-ink` / `ink-soft` / `ink-faint` | Primary, secondary, tertiary text | near-black navy |
| `--color-persimmon` / `persimmon-deep` | Sole saturated accent (CTAs, active state, brand) | warm orange-red |
| `--color-runway` | Warning / amber alerts | runway-marking yellow |
| `--color-hangar` | Positive / healthy state | deep service green |
| `--color-beacon` | Destructive / alert | warning red |
| `--color-midnight` | Sidebar, hero panels (timetable feel) | deep navy |

**Typography** — three faces, pinned via `next/font` and exposed as `--font-display`, `--font-sans`, `--font-mono`:

- **Fraunces** (variable serif, SOFT + opsz axes) — display headlines, editorial gravitas.
- **IBM Plex Sans** — UI labels and body, technical-but-warm.
- **IBM Plex Mono** — tabular data, IATA codes, schedules; tabular-figures and `zero` slashed by default.

Two reusable type primitives: `.label-code` (mono, all-caps, 0.16em tracking) for IATA-style codes, and `.label-eyebrow` (sans, all-caps, 0.28em tracking) for editorial section eyebrows.

**Composition language**:
- **Three-letter IATA codes** for every navigation destination (`OPS`, `GLB`, `FLT`, `NET`, `FIN`, `TEC`, `EVT`, `NWS`).
- **Boarding-pass cards** — flat paper, 1px ink border, hard offset shadow, eyebrow strip with code + meta.
- **Editorial double-rule** under page headers (top: 2px ink + 1px paper gap + 1px ink shadow).
- **Subtle paper grain** body background (two layered radial-dot gradients).
- **Compass-rose watermark** drifting at 240s/turn behind dashboard pages.

**Motion**:
- `flap-in` — split-flap-style number reveal for KPIs (380ms cubic-bezier with overshoot).
- `pulse-beacon` — slow opacity pulse on the active sidebar item and "Live" indicators.
- `drift-slow` — 240s rotation on the compass watermark.

**Radii**: deliberately tight (2–4px) — paper documents have crisp edges, not iOS-style softness.

**Memorable elements**:
- The **departure-board topbar** with airline call-sign card on the left, scrolling KPI strip in the centre (`CASH`, `FLEET`, `ROUTES`, `PAX/DAY`, `OTP`, `REP`), captain chip on the right, and a wallclock/game-time row beneath.
- **Sidebar as flight-info display** — dark midnight surface, IATA code + full label per item, persimmon beacon on the active row.

### 7.2 Shell architecture

The authenticated app lives under the `(app)` route group, whose layout (`src/app/(app)/layout.tsx`) enforces auth and wraps every page in `<AppShell>`:

- `AppSidebar` — persistent navigation, dark midnight palette, IATA-coded items.
- `AppTopbar` — airline call-sign + KPI strip + user menu + game/real wallclock row.
- `PageHeader` — code · eyebrow · display headline · description · actions.
- `BoardingCard` / `BoardingCardEyebrow` / `StatBlock` — primitives for sectioned content.
- `RunwayStub` — full-bleed editorial placeholder for not-yet-implemented sections.

## 8. Tech Stack & Architecture

| Layer | Choice |
|---|---|
| Runtime / package manager | **Bun** |
| Framework | **Next.js** (App Router) |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| 3D | **Three.js** (likely via `@react-three/fiber`) |
| ORM / DB | **Drizzle ORM** + **SQLite** (single file, mounted volume) |
| Auth | **Better Auth** with **Google OAuth** |
| Deployment | **Docker + docker-compose**, target **Dokploy** |

### 8.1 Multi-tenancy

Single deployment, multiple users. Each user has one (or later, multiple) saved game(s). All gameplay tables carry a `gameId` (which carries a `userId`). Reference data (airports, aircraft types, real airlines, event templates, tech-tree nodes) is shared and read-only at runtime.

### 8.2 Catch-up Simulation

No background server tick. On every authenticated request (or explicit "resume" action), the server:
1. Reads `lastSimulatedAt`, computes elapsed game-time (capped at 7 real days = ~84 game days at 0.5× offline rate).
2. Runs the catch-up sim in chunks (e.g., one game-day per tick, or coarser daily aggregates for long gaps).
3. Persists final state + a structured `NewsEvents` table of what happened.
4. Renders the newspaper summary from those events.

Sim must be **deterministic given (state, seed, elapsedTime)** so it can be replayed/debugged.

### 8.3 Data-Driven Content (DB-resident, not hardcoded)

This is a hard requirement: balance and content tweaks must not require a code deploy.

- **Airports** (IATA, ICAO, city, country, lat/lon, size tier, slot constraint level)
- **Aircraft types** (all attributes in §4.1)
- **Real airlines** (name, hub list, fleet composition seed, AI behavior params)
- **Routes (real-world reference)** — for seeding competitor networks
- **Tech-tree nodes** (id, branch, prereqs, cost, effects)
- **Random event templates** (conditions, weights, effect script, choice options)
- **Finance instruments** (rates, terms, eligibility)
- **Game-balance constants** (single key/value table — fuel base price, demand elasticity, etc.)

Migrations via Drizzle. Seed data lives as committed JSON/CSV files imported on first boot; an admin route allows hot-reloading certain tables (events, balance constants) without restart.

### 8.4 Save / Load

One active save per user MVP; multiple slots post-MVP. Saves are server-side (in SQLite). Manual "export save" (JSON download) for backup.

## 9. Deployment

- `Dockerfile` — Bun-based build, multi-stage, produces a single runnable image.
- `docker-compose.yml` — service + named volume for the SQLite file + volume for backups.
- Target host: **Dokploy**. Compose file is the contract.
- Backups: nightly cron container that copies the SQLite file with `VACUUM INTO` to a backups volume.

## 10. Out of Scope (MVP)

- Real-time multiplayer / PvP.
- Mobile-native apps.
- In-app purchases / monetization.
- Voice or audio.
- Live competitor data feeds (fleets/routes are seeded snapshots, refreshed manually).
- Localization (English-only at launch).

## 11. Phased Build Plan

**Phase 0 — Foundation:** Bun + Next.js + Drizzle + SQLite + Better Auth + Docker. Hello-world deploy to Dokploy.

Phase 0 checklist:
- [x] Verify Bun is installed and capture version (Bun 1.3.9, Node 25.6.1)
- [x] Initialize Next.js (App Router, TypeScript, Tailwind) via `bunx create-next-app` (Next 16.2.4, React 19.2.4, Tailwind 4)
- [x] Confirm dev server runs under Bun (`bun run dev`) — Next 16.2.4 Turbopack, ready in ~14s, `/` returns 200
- [x] Add `.gitignore`, `.env.example`, repo `README.md` with local setup instructions
- [x] Initialize shadcn/ui (`bunx shadcn@latest init`) and install a couple of seed components (button, card)
- [x] Add Drizzle ORM + `bun:sqlite` driver; create `src/db/` with client, schema (auth tables only for now), and `drizzle.config.ts`
- [x] Wire `bun run db:generate` and `bun run db:migrate` scripts (initial migration `0000_tidy_leo.sql` applied)
- [x] Install Better Auth, configure Google OAuth provider, mount API route at `/api/auth/[...all]`
- [x] Add a minimal protected page that shows the signed-in user's email (proves auth + DB work end-to-end) — `/dashboard`, redirects unauthenticated → `/`
- [x] Add landing page placeholder ("Airline Tycoon — coming soon", sign-in button) — `/` with `SignInButton`, redirects authenticated → `/dashboard`
- [x] Multi-stage `Dockerfile` (Bun base, build, runtime) — produce a single runnable image
- [x] `docker-compose.yml` with named volume for SQLite file + named volume for backups (+ nightly `VACUUM INTO` backup sidecar, retains last 14)
- [x] Smoke-test the docker build locally — image built, container booted in 184ms after `Migrations applied to /data/airline-tycoon.sqlite`; `/` → 200, `/dashboard` → 307 (correctly redirects unauthenticated), `/api/auth/get-session` → 200
- [x] Mark Phase 0 done; ready for Phase 1 seeding work

**Phase 1 — Static world:** Seed airports, aircraft, real airlines. 3D globe renders airports + great-circle arcs.

Phase 1 checklist:
- [x] Add `airport`, `aircraft_type`, `airline`, `airline_hub` tables to Drizzle schema; generate + apply migration (`0001_whole_northstar.sql`)
- [x] Curate `src/data/seeds/aircraft.json` — 32 commercial types (turboprops → A380/777-9), real specs
- [x] Curate `src/data/seeds/airlines.json` — 50 carriers (5 AU + 1 NZ · 14 NA · 23 EU · 7 global hubs), IATA/ICAO, hubs (134 total), alliance, fleet size, AI params, brand colours
- [x] Add `scripts/fetch-airports.ts` — pulls OurAirports CSV, filters to large + (medium-in-focus-regions)
- [x] Run fetcher; committed `src/data/seeds/airports.json` (2,887 airports — 1,177 large global + 1,710 medium in focus regions)
- [x] Document data sources + licences in `README.md`
- [x] Write `scripts/seed.ts` — idempotent upsert across all 4 tables in a single transaction
- [x] Wire seeding into the Dockerfile entrypoint (after migrations) — verified: container seeds in 320ms on boot
- [x] Install `three`, `@react-three/fiber`, `@react-three/drei`, `world-atlas`, `topojson-client`, `d3-geo`
- [x] Build `<Globe>` client component — cream paper sphere · darker land flat-shaded · ink coastlines + tropics/polar graticule · 3-tier airport points (slot-constrained = persimmon, large = runway yellow, medium = ink dots) · OrbitControls with auto-rotate
- [x] Wire `/globe` page — server fetches all airports + top 8 carriers + per-continent counts; sidecar shows slot-constrained hubs, top carriers (with brand colour swatch), continent coverage
- [x] Dashboard now surfaces real seed counts in a "REF / OPR / EQP / Phase" strip (the topbar KPIs stay placeholder until Phase 2 brings player game state)
- [x] Smoke-test: build passes, dev `/globe` returns 307 (auth-gated correctly), docker image rebuilds + boots + seeds + serves in <1s end-to-end
- [x] Mark Phase 1 done; ready for Phase 2 (core sim)

**Phase 2 — Core sim:** Player can buy 1 aircraft, open 1 route, see profit tick. Time model + offline catch-up + newspaper summary.

**Phase 3 — Depth:** Finance instruments (loans, leases), reputation, staffing, demand model with competition.

**Phase 4 — Content:** Tech tree, random events, real-airline AI, codeshares, alliances.

**Phase 5 — Endgame:** Merger/prestige loop, specialization branches, balance pass.

**Phase 6 — Polish:** Mobile responsive, save export/import, admin balance-tuning UI.
