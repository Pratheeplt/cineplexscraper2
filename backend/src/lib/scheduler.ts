// Background scheduler: periodically checks each watch for NEW showtimes on its
// target date and fires Telegram notifications the moment one appears.
import type { HistoryEntry, ShowSession, Watch } from "../types";
import { fetchBookableDates, fetchShowtimes } from "./cineplex";
import {
  getSettings,
  getWatches,
  getWatch,
  updateWatch,
  getSeen,
  setSeen,
  addHistory,
} from "./store";
import { sendTelegram } from "./telegram";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
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

  // Refresh bookable dates (for the dashboard) — non-fatal if it fails.
  let bookableDates = watch.bookableDates;
  try {
    bookableDates = await fetchBookableDates(watch.filmId, watch.locationId);
  } catch (e) {
    console.error(`[scheduler] bookable dates failed for watch ${watchId}:`, (e as Error).message);
  }

  const sessions = await fetchShowtimes(watch.filmId, watch.locationId, watch.date);

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
  } catch (e) {
    console.error("[scheduler] tick error:", e);
  } finally {
    running = false;
  }
}

/** (Re)start the interval loop from the current settings. */
export function restartScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const { intervalMinutes, enabled } = getSettings();
  const ms = Math.max(1, intervalMinutes) * 60 * 1000;
  timer = setInterval(tick, ms);
  console.log(
    `[scheduler] ${enabled ? "enabled" : "disabled"} — interval ${intervalMinutes} min (${ms} ms)`
  );
}

export function startScheduler(): void {
  restartScheduler();
  console.log("[scheduler] started");
}
