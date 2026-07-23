# Cineplex Scraper + Showtime Notifier

Live movie/theatre data from cineplex.com, plus a **Notify** system that watches a
specific film at a specific theatre for a specific date and sends a **Telegram alert
the moment a new showtime opens for booking** — including the format (IMAX, UltraAVX,
Recliner, VIP, D-BOX, 3D…), auditorium, time and seats remaining.

## Features

- **Movies** tab — now playing / coming soon, posters, runtime, genres.
- **Theatres** tab — searchable theatre directory.
- **Notify** tab
  - Type-ahead pickers for film and theatre (filter as you type).
  - Pick a date to watch — even one that isn't bookable yet.
  - Shows **film name + theatre name** (not IDs), formats per showtime, full timings,
    and the latest bookable dates.
  - Background checker on a **preset interval** (5 min → once a day).
  - **Telegram alerts** via [t.me/cineplexscraperbot](https://t.me/cineplexscraperbot).
  - **Delete** a watch to stop being notified.
  - History of every detected showtime — **persists across restarts**.
- A **Notify me** button on every movie card jumps to the Notify tab with the film
  pre-selected.

## Architecture

| Part | Stack | Port (dev) |
|------|-------|-----------|
| `webapp/` | React + Vite + Tailwind + shadcn/ui | 8000 |
| `backend/` | Bun + Hono + Zod | 3000 |

In production both are served from a **single container on port 8080**: the backend
serves the built webapp (`STATIC_DIR`) alongside the API.

### Persistence

Notify data (watches, history, settings) is stored as JSON in `DATA_DIR`
(default `/app/data` in Docker). Mount it as a volume to survive restarts.

### Logs

Everything logs to **stdout** — view with `docker logs -f cineplexscraper`.
Look for `[scheduler]`, `[store]`, `[notify]` and `[static]` prefixes.

## Deploy (Docker)

```bash
docker compose up -d --build
docker logs -f cineplexscraper
```

The app is published on **port 8080**. Open `http://<your-vps-ip>:8080` in a browser.
To use a different host port, change the left side of `ports` in `docker-compose.yml`
(e.g. `"80:8080"` to serve on the standard HTTP port).

Already running an old container from a previous project? Reset first:

```bash
docker compose down
docker compose up -d --build
```

Running behind a Traefik reverse proxy with your own domain instead? See the
commented `labels` block in `docker-compose.yml`.

### Telegram setup

1. Open [t.me/cineplexscraperbot](https://t.me/cineplexscraperbot) and send `/start`.
2. In the app → **Notify** tab → **Connect** (auto-detects your chat).
3. Hit **Test** to confirm.

Override the bot token with the `TELEGRAM_BOT_TOKEN` env var if needed.

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cineplex` | movies (`?filter=now-playing\|coming-soon`) |
| GET | `/api/cineplex/theatres` | theatres |
| GET | `/api/cineplex/dates?filmId=&locationId=` | bookable dates |
| GET | `/api/cineplex/showtimes?filmId=&locationId=&date=` | showtimes w/ formats |
| GET/POST/DELETE | `/api/notify/watches` | manage watches |
| POST | `/api/notify/check-now` | check all watches immediately |
| GET/PATCH | `/api/notify/settings` | interval + telegram |
| POST | `/api/notify/telegram/connect` · `/test` | telegram wiring |
| GET | `/api/notify/history` | detected-showtime history |
