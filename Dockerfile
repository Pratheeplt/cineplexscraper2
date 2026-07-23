# ---------------------------------------------------------------------------
# Cineplex Scraper — single container serving the React webapp + Hono API.
# Runs on PORT 8080. Persistent Notify data lives in /app/data (mount a volume).
# All logs go to stdout so they're visible via `docker logs <container>`.
# ---------------------------------------------------------------------------

# ---- Stage 1: build the webapp -------------------------------------------
FROM oven/bun:1 AS webbuild
WORKDIR /app

# The webapp imports shared types from ../backend/src/types, so both are needed.
COPY backend/ ./backend/
COPY webapp/ ./webapp/

WORKDIR /app/webapp
RUN bun install --frozen-lockfile || bun install
RUN bun run build   # -> /app/webapp/dist

# ---- Stage 2: runtime -----------------------------------------------------
FROM oven/bun:1
WORKDIR /app/backend

# Install backend dependencies
COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Backend source
COPY backend/ ./

# Built webapp served as static files from ./public (relative to cwd /app/backend)
COPY --from=webbuild /app/webapp/dist ./public

ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=public \
    DATA_DIR=/app/data

# Persistent Notify data (watches + history + settings) survives restarts.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8080

# Run the server directly (no hot reload). Logs stream to stdout.
CMD ["bun", "run", "src/index.ts"]
