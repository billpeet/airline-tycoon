# syntax=docker/dockerfile:1.7
# Multi-stage Bun build for Next.js (App Router) + Drizzle/SQLite.

ARG BUN_VERSION=1.3.9

# ---------- deps ----------
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- build ----------
FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build needs a non-empty BETTER_AUTH_SECRET so the auth module doesn't fall back
# to the dev placeholder during page-data collection. Real secret is injected at runtime.
ENV NODE_ENV=production \
    BETTER_AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    DATABASE_URL=/tmp/build.sqlite
RUN bun --bun next build

# ---------- runtime ----------
FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=/data/airline-tycoon.sqlite

RUN addgroup -S app && adduser -S app -G app \
 && mkdir -p /data && chown -R app:app /data

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/next.config.ts ./next.config.ts
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/drizzle.config.ts ./drizzle.config.ts

USER app
EXPOSE 3000
VOLUME ["/data"]

# Apply pending migrations on boot, then start.
CMD ["sh", "-c", "bun run src/db/migrate.ts && bun --bun next start -H 0.0.0.0 -p 3000"]
