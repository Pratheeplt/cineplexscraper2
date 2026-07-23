// Background catalog scanner: periodically fetches the whole movie list and
// diffs it against the last snapshot to surface catalog-level changes
// (new movies, advance tickets released, now-playing transitions, date changes).
// Detected changes feed the Activity tab and can trigger Telegram alerts.
import type { ActivityEvent, Movie } from "../types";
import { fetchMovies } from "./cineplex";
import {
  getSettings,
  getCatalog,
  setCatalog,
  isCatalogInitialized,
  addActivity,
  type CatalogEntry,
} from "./store";
import { sendTelegram } from "./telegram";

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `a_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

function fmtDate(date?: string | null): string {
  if (!date) return "TBA";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function toEntry(m: Movie): CatalogEntry {
  return {
    name: m.name,
    hasAdvanceTickets: m.hasAdvanceTickets,
    releaseDate: m.releaseDate ?? null,
    isNowPlaying: m.isNowPlaying,
  };
}

/**
 * Scan the catalog once. On the very first run it just records a baseline (no
 * events). Afterwards it emits an ActivityEvent for every detected change.
 * When `notify` is true and the user enabled advance-ticket alerts, a Telegram
 * message is sent summarizing newly-released advance tickets.
 */
export async function scanCatalog(notify: boolean): Promise<ActivityEvent[]> {
  const movies = await fetchMovies();
  const prev = getCatalog();
  const baseline = !isCatalogInitialized();

  const now = new Date().toISOString();
  const events: ActivityEvent[] = [];
  const nextCatalog: Record<string, CatalogEntry> = {};

  for (const m of movies) {
    const key = String(m.id);
    nextCatalog[key] = toEntry(m);
    if (baseline) continue; // first run — record snapshot only

    const before = prev[key];
    const base = { filmId: m.id, filmName: m.name, posterUrl: m.mediumPosterImageUrl ?? null };

    if (!before) {
      events.push({
        id: newId(),
        type: "new_movie",
        ...base,
        detail: m.isComingSoon ? "New movie coming soon" : "New movie added",
        releaseDate: m.releaseDate ?? null,
        detectedAt: now,
      });
      // A brand-new movie that already has advance tickets is worth flagging too.
      if (m.hasAdvanceTickets) {
        events.push({
          id: newId(),
          type: "advance_tickets",
          ...base,
          detail: "Advance tickets available",
          releaseDate: m.releaseDate ?? null,
          detectedAt: now,
        });
      }
      continue;
    }

    if (!before.hasAdvanceTickets && m.hasAdvanceTickets) {
      events.push({
        id: newId(),
        type: "advance_tickets",
        ...base,
        detail: "Advance tickets just released",
        releaseDate: m.releaseDate ?? null,
        detectedAt: now,
      });
    }

    if (!before.isNowPlaying && m.isNowPlaying) {
      events.push({
        id: newId(),
        type: "now_playing",
        ...base,
        detail: "Now playing in theatres",
        releaseDate: m.releaseDate ?? null,
        detectedAt: now,
      });
    }

    const beforeDate = before.releaseDate ?? null;
    const afterDate = m.releaseDate ?? null;
    if (beforeDate !== afterDate && afterDate) {
      events.push({
        id: newId(),
        type: "release_date",
        ...base,
        detail: `Release date changed to ${fmtDate(afterDate)}`,
        releaseDate: afterDate,
        detectedAt: now,
      });
    }
  }

  setCatalog(nextCatalog);

  if (events.length > 0) {
    addActivity(events);
    console.log(`[catalog] ${events.length} change(s) detected`);
  }

  // Telegram alert for newly-released advance tickets (opt-in).
  if (notify && !baseline) {
    const { notifyAdvanceTickets, telegramBotToken, telegramChatId } = getSettings();
    const advEvents = events.filter((e) => e.type === "advance_tickets");
    if (notifyAdvanceTickets && telegramBotToken && telegramChatId && advEvents.length > 0) {
      try {
        const lines = advEvents
          .map((e) => `🎟 *${e.filmName}* — releases ${fmtDate(e.releaseDate)}`)
          .join("\n");
        await sendTelegram(`*Advance tickets just released:*\n${lines}`);
        console.log(`[catalog] advance-ticket Telegram alert sent (${advEvents.length})`);
      } catch (e) {
        console.error("[catalog] Telegram send failed:", (e as Error).message);
      }
    }
  }

  return events;
}
