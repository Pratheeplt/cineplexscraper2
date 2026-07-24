// Background catalog scanner: periodically fetches the whole movie list and
// diffs it against the last snapshot to surface catalog-level changes
// (new movies, advance tickets released, now-playing transitions, date changes).
// Detected changes feed the Activity tab and can trigger Telegram alerts.
import type { ActivityEvent, Movie, ShowSession } from "../types";
import { fetchMovies, fetchFilmShowtimesByDate, isEnglishLanguage } from "./cineplex";
import {
  getSettings,
  getCatalog,
  setCatalog,
  isCatalogInitialized,
  addActivity,
  getFavorites,
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

// A bookable date is always YYYY-MM-DD; anchor it to midnight local time.
function fmtShowDate(date: string): string {
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
    const base = {
      filmId: m.id,
      filmName: m.name,
      posterUrl: m.mediumPosterImageUrl ?? null,
      language: m.language ?? null,
    };

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

  // Movies that were in the previous snapshot but are gone from the API now.
  // (Skipped on the baseline run, when `prev` is empty anyway.)
  if (!baseline) {
    for (const [key, before] of Object.entries(prev)) {
      if (nextCatalog[key]) continue;
      events.push({
        id: newId(),
        type: "removed_movie",
        filmId: Number(key),
        filmName: before.name,
        posterUrl: null,
        detail: "Removed from Cineplex",
        releaseDate: before.releaseDate ?? null,
        detectedAt: now,
      });
      console.log(`[catalog] movie removed from catalog: "${before.name}" (${key})`);
    }
  }

  setCatalog(nextCatalog);

  if (events.length > 0) {
    addActivity(events);
    console.log(`[catalog] ${events.length} change(s) detected`);
  }

  // Telegram alert for newly-released advance tickets (opt-in).
  // Only alert for films that actually have showtimes at one of the user's
  // FAVOURITE theatres — and include the real dates + showtimes. A film with no
  // bookable showtimes at any favourite theatre is dropped entirely, so nothing
  // without showtimes ever reaches the notification.
  if (notify && !baseline) {
    const { notifyAdvanceTickets, telegramBotToken, telegramChatId, hideInternational } =
      getSettings();
    let advEvents = events.filter((e) => e.type === "advance_tickets");
    // Respect the "hide international" setting — don't alert for non-English films.
    if (hideInternational) advEvents = advEvents.filter((e) => isEnglishLanguage(e.language));

    if (notifyAdvanceTickets && telegramBotToken && telegramChatId && advEvents.length > 0) {
      const { theatres } = getFavorites();
      if (theatres.length === 0) {
        console.log(
          "[catalog] advance tickets detected but no favourite theatres set — no alert"
        );
      } else {
        // Build one block per (film × favourite theatre) that actually has
        // showtimes, listing each bookable date and its sessions.
        const blocks: string[] = [];
        for (const e of advEvents) {
          for (const theatre of theatres) {
            let byDate: Map<string, ShowSession[]>;
            try {
              byDate = await fetchFilmShowtimesByDate(e.filmId, theatre.theatreId);
            } catch (err) {
              console.error(
                `[catalog] advance showtimes failed for ${e.filmName} @ ${theatre.theatreName}:`,
                (err as Error).message
              );
              continue;
            }
            // Only dates with real sessions count — skip theatres with none.
            const dates = [...byDate.keys()].sort();
            if (dates.length === 0) continue;

            const dateBlocks = dates
              .map((date) => {
                const sessions = byDate.get(date) ?? [];
                const lines = sessions.slice(0, 10).map(sessionLine);
                const extra = sessions.length - 10;
                if (extra > 0) lines.push(`  …and ${extra} more`);
                return `📅 ${fmtShowDate(date)}\n${lines.join("\n")}`;
              })
              .join("\n");
            blocks.push(`🎟 *${e.filmName}* @ ${theatre.theatreName}\n${dateBlocks}`);
          }
        }

        if (blocks.length === 0) {
          console.log(
            "[catalog] advance tickets detected but none playing at favourite theatres with showtimes — no alert"
          );
        } else {
          try {
            await sendTelegram(
              `🎟 *Advance tickets at your favourite theatres:*\n\n${blocks.join("\n\n")}`
            );
            console.log(`[catalog] advance-ticket Telegram alert sent (${blocks.length} block(s))`);
          } catch (err) {
            console.error("[catalog] Telegram send failed:", (err as Error).message);
          }
        }
      }
    }
  }

  return events;
}
