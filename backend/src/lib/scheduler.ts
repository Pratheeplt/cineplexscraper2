// Background scheduler: periodically checks each watch for NEW showtimes on its
// target date and fires Telegram notifications the moment one appears.
import type { ActivityEvent, HistoryEntry, ShowSession, Watch } from "../types";
import { fetchFilmShowtimesByDate } from "./cineplex";
import {
  getSettings,
  getWatches,
  getWatch,
  updateWatch,
  getSeen,
  setSeen,
  addHistory,
  getFavorites,
  getFavSeenDates,
  setFavSeenDates,
  addActivity,
} from "./store";
import { sendTelegram } from "./telegram";
import { scanCatalog } from "./catalog";

let timer: ReturnType<typeof setInterval> | null = null;
let catalogTimer: ReturnType<typeof setInterval> | null = null;
let running = false;
let catalogRunning = false;
let idCounter = 0;

function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function fmtDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(dt: string): string {
  const d = new Date(dt);
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

function sessionLine(s: ShowSession): string {
  const parts = [fmtTime(s.startDateTime)];
  if (s.experienceTypes.length) parts.push(s.experienceTypes.join(" / "));
  if (s.auditorium) parts.push(s.auditorium);
  if (typeof s.seatsRemaining === "number") parts.push(`${s.seatsRemaining} seats`);
  return `• ${parts.join(" · ")}`;
}

/**
 * Check one watch. Returns the newly-detected sessions.
 * When `notify` is true and there are new sessions, records history and sends a
 * Telegram alert. When false (baseline on creation), it just records what exists
 * so future checks only surface genuinely new showtimes.
 */
export async function checkWatch(watchId: string, notify: boolean): Promise<ShowSession[]> {
  const watch = getWatch(watchId);
  if (!watch) return [];

  // One upstream call gives us every date that has real showtimes (the dashboard
  // "bookable dates") plus the sessions for the target date. Dates with no
  // showtimes are omitted, so far-future placeholder dates never show up.
  const byDate = await fetchFilmShowtimesByDate(watch.filmId, watch.locationId);
  const bookableDates = [...byDate.keys()].sort();
  const sessions = byDate.get(watch.date) ?? [];

  const seen = getSeen(watchId);
  const fresh = sessions.filter((s) => !seen.has(s.sessionId));

  // Always keep the latest snapshot + dates + timestamp.
  updateWatch(watchId, {
    sessions,
    bookableDates,
    lastCheckedAt: new Date().toISOString(),
  });
  setSeen(watchId, sessions.map((s) => s.sessionId));

  if (fresh.length === 0) return [];

  if (notify) {
    const now = new Date().toISOString();
    const entries: HistoryEntry[] = fresh.map((s) => ({
      id: newId("h"),
      watchId,
      filmName: watch.filmName,
      theatreName: watch.theatreName,
      date: watch.date,
      startDateTime: s.startDateTime,
      experienceTypes: s.experienceTypes,
      auditorium: s.auditorium ?? null,
      seatsRemaining: s.seatsRemaining ?? null,
      detectedAt: now,
    }));
    addHistory(entries);

    console.log(
      `[scheduler] ${fresh.length} NEW showtime(s) for "${watch.filmName}" @ ${watch.theatreName} on ${watch.date}`
    );

    try {
      const header = `🎬 *${watch.filmName}*\n📍 ${watch.theatreName}\n📅 ${fmtDate(watch.date)}\n\n*${fresh.length} new showtime${fresh.length === 1 ? "" : "s"}:*`;
      const body = fresh.map(sessionLine).join("\n");
      await sendTelegram(`${header}\n${body}`);
      console.log(`[scheduler] Telegram alert sent for watch ${watchId}`);
    } catch (e) {
      console.error(`[scheduler] Telegram send failed for watch ${watchId}:`, (e as Error).message);
    }
  }

  return fresh;
}

/** Run a check across all watches. */
export async function checkAllWatches(notify = true): Promise<number> {
  const watches = getWatches();
  if (watches.length === 0) return 0;
  console.log(`[scheduler] checking ${watches.length} watch(es)…`);
  let totalNew = 0;
  for (const w of watches) {
    try {
      const fresh = await checkWatch(w.id, notify);
      totalNew += fresh.length;
    } catch (e) {
      console.error(`[scheduler] check failed for watch ${w.id} (${w.filmName}):`, (e as Error).message);
    }
  }
  console.log(`[scheduler] cycle complete — ${totalNew} new showtime(s) detected`);
  return totalNew;
}

/**
 * Check every favorite movie × favorite theatre for NEW bookable dates.
 * The first check per pair records a silent baseline (no alert) so that newly
 * favorited items don't dump all their current dates as "new". Returns the total
 * number of new dates detected. When `notify` is true, records an Activity event
 * per new date and sends one summary Telegram message (if enabled + configured).
 */
export async function checkFavoriteDates(notify: boolean): Promise<number> {
  const { movies, theatres } = getFavorites();
  if (movies.length === 0 || theatres.length === 0) return 0;

  let totalNew = 0;
  // Grouped fresh dates (with their showtimes) for the Telegram summary.
  const groups: {
    header: string;
    dates: { date: string; sessions: ShowSession[] }[];
  }[] = [];

  for (const movie of movies) {
    for (const theatre of theatres) {
      const key = `${movie.filmId}_${theatre.theatreId}`;
      let byDate: Map<string, ShowSession[]>;
      try {
        byDate = await fetchFilmShowtimesByDate(movie.filmId, theatre.theatreId);
      } catch (e) {
        console.error(
          `[favorites] showtimes failed for ${movie.filmName} @ ${theatre.theatreName}:`,
          (e as Error).message
        );
        continue;
      }

      // Only dates that actually have showtimes count as "released/bookable".
      // This is the fix: a movie with far-future placeholder dates but no
      // showtimes behind them no longer triggers a "new date" alert.
      const dates = [...byDate.keys()].sort();

      const seen = getFavSeenDates(key);
      if (seen === undefined) {
        // Baseline for this pair — record silently, don't notify.
        setFavSeenDates(key, dates);
        continue;
      }

      const fresh = dates.filter((d) => !seen.includes(d));
      setFavSeenDates(key, dates);
      if (fresh.length === 0) continue;

      totalNew += fresh.length;
      const freshWithSessions = fresh.map((d) => ({ date: d, sessions: byDate.get(d) ?? [] }));
      groups.push({
        header: `🎬 *${movie.filmName}* @ ${theatre.theatreName}`,
        dates: freshWithSessions,
      });

      const now = new Date().toISOString();
      const events: ActivityEvent[] = freshWithSessions.map(({ date, sessions }) => ({
        id: newId("f"),
        type: "favorite_date" as const,
        filmId: movie.filmId,
        filmName: movie.filmName,
        posterUrl: movie.posterUrl ?? null,
        detail: `${sessions.length} showtime${sessions.length === 1 ? "" : "s"} at ${theatre.theatreName} · ${fmtDate(date)}`,
        date,
        sessions,
        detectedAt: now,
      }));
      addActivity(events);

      console.log(
        `[favorites] ${fresh.length} NEW date(s) with showtimes for "${movie.filmName}" @ ${theatre.theatreName}`
      );
    }
  }

  if (notify && groups.length > 0) {
    const { notifyFavoriteDates, telegramBotToken, telegramChatId } = getSettings();
    if (notifyFavoriteDates && telegramBotToken && telegramChatId) {
      try {
        const body = groups
          .map((g) => {
            const dateBlocks = g.dates
              .map(({ date, sessions }) => {
                const lines = sessions.slice(0, 10).map(sessionLine);
                const extra = sessions.length - 10;
                if (extra > 0) lines.push(`  …and ${extra} more`);
                return `📅 ${fmtDate(date)}\n${lines.join("\n")}`;
              })
              .join("\n");
            return `${g.header}\n${dateBlocks}`;
          })
          .join("\n\n");
        await sendTelegram(`🎟 *New showtimes for your favourite movies:*\n\n${body}`);
        console.log("[favorites] Telegram alert sent");
      } catch (e) {
        console.error("[favorites] Telegram send failed:", (e as Error).message);
      }
    }
  }

  return totalNew;
}

async function tick(): Promise<void> {
  if (running) {
    console.log("[scheduler] previous cycle still running, skipping tick");
    return;
  }
  const { enabled } = getSettings();
  if (!enabled) return;
  running = true;
  try {
    await checkAllWatches(true);
    await checkFavoriteDates(true);
  } catch (e) {
    console.error("[scheduler] tick error:", e);
  } finally {
    running = false;
  }
}

/** Run a full catalog scan (new movies, advance tickets, date changes). */
export async function scanCatalogNow(notify = true): Promise<number> {
  const events = await scanCatalog(notify);
  return events.length;
}

async function catalogTick(): Promise<void> {
  if (catalogRunning) {
    console.log("[catalog] previous scan still running, skipping tick");
    return;
  }
  const { catalogEnabled } = getSettings();
  if (!catalogEnabled) return;
  catalogRunning = true;
  try {
    await scanCatalog(true);
  } catch (e) {
    console.error("[catalog] tick error:", (e as Error).message);
  } finally {
    catalogRunning = false;
  }
}

/** (Re)start both interval loops from the current settings. */
export function restartScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (catalogTimer) {
    clearInterval(catalogTimer);
    catalogTimer = null;
  }
  const { intervalMinutes, enabled, catalogIntervalMinutes, catalogEnabled } = getSettings();

  const ms = Math.max(1, intervalMinutes) * 60 * 1000;
  timer = setInterval(tick, ms);
  console.log(
    `[scheduler] ${enabled ? "enabled" : "disabled"} — interval ${intervalMinutes} min (${ms} ms)`
  );

  const catalogMs = Math.max(1, catalogIntervalMinutes) * 60 * 1000;
  catalogTimer = setInterval(catalogTick, catalogMs);
  console.log(
    `[catalog] ${catalogEnabled ? "enabled" : "disabled"} — interval ${catalogIntervalMinutes} min (${catalogMs} ms)`
  );
}

export function startScheduler(): void {
  restartScheduler();
  // Establish a catalog baseline at startup so the next scan can detect changes.
  scanCatalog(false)
    .then((e) => console.log(`[catalog] baseline established (${e.length} events)`))
    .catch((err) => console.error("[catalog] baseline scan failed:", (err as Error).message));
  console.log("[scheduler] started");
}
