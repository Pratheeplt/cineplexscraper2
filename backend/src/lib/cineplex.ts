// Shared Cineplex API client + normalizers.
// Used by both the HTTP routes and the background scheduler.
import { MovieSchema, ShowSessionSchema, type Movie, type ShowSession } from "../types";

const CINEPLEX_KEY = "dcdac5601d864addbc2675a2e96cb1f8"; // public key from cineplex.com website JS

/** A film is "international" when its spoken language isn't English. */
export function isEnglishLanguage(language?: string | null): boolean {
  return (language ?? "").trim().toLowerCase() === "english";
}

export async function cineplex(path: string): Promise<unknown> {
  const res = await fetch(`https://apis.cineplex.com/prod/cpx/theatrical/api/v1/${path}`, {
    headers: {
      "Ocp-Apim-Subscription-Key": CINEPLEX_KEY,
      accept: "*/*",
      origin: "https://www.cineplex.com",
      referer: "https://www.cineplex.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Cineplex ${path} -> ${res.status}`);
  return res.json();
}

/**
 * The full movie catalog (en). Normalizes each item and derives
 * `hasAdvanceTickets` (a Coming Soon film that already has showtimes loaded).
 * Shared by the /api/cineplex route and the background catalog scanner.
 */
export async function fetchMovies(): Promise<Movie[]> {
  const raw = (await cineplex("movies?language=en")) as { items?: unknown[] };
  const items = Array.isArray(raw.items) ? raw.items : [];
  return items.map((item) => {
    const m = MovieSchema.parse(item);
    m.hasAdvanceTickets = m.isComingSoon && m.hasShowtimes;
    return m;
  });
}

/**
 * The set of film IDs that a theatre plays across ALL of its upcoming dates
 * (now playing + advance-ticket coming soon). One call, no date param — the
 * Cineplex showtimes endpoint returns every bookable date for the location.
 * Used by the webapp to filter the movie list down to a selected theatre.
 */
export async function fetchTheatreFilmIds(locationId: number): Promise<number[]> {
  const raw = (await cineplex(
    `showtimes?language=en&locationId=${locationId}`
  )) as RawTheatreShowtimes[];

  const ids = new Set<number>();
  for (const theatre of Array.isArray(raw) ? raw : []) {
    for (const d of theatre.dates ?? []) {
      for (const m of d.movies ?? []) {
        if (typeof m.id === "number") ids.add(m.id);
      }
    }
  }
  return [...ids];
}

type RawSession = {
  vistaSessionId?: number;
  showStartDateTime?: string;
  auditorium?: string | null;
  seatsRemaining?: number | null;
  isSoldOut?: boolean;
  ticketingUrl?: string | null;
  deeplinkUrl?: string | null;
  seatMapUrl?: string | null;
  isReservedSeating?: boolean;
};
type RawExperience = { experienceTypes?: string[]; sessions?: RawSession[] };
type RawMovie = { id?: number; experiences?: RawExperience[] };
type RawDate = { startDate?: string; movies?: RawMovie[] };
type RawTheatreShowtimes = { theatreId?: number; dates?: RawDate[] };

/** Normalize one raw "experience" grouping's sessions into ShowSession[]. */
function parseExperience(exp: RawExperience): ShowSession[] {
  const types = exp.experienceTypes ?? [];
  const out: ShowSession[] = [];
  for (const s of exp.sessions ?? []) {
    if (typeof s.vistaSessionId !== "number" || !s.showStartDateTime) continue;
    out.push(
      ShowSessionSchema.parse({
        sessionId: s.vistaSessionId,
        startDateTime: s.showStartDateTime,
        auditorium: s.auditorium ?? null,
        seatsRemaining: s.seatsRemaining ?? null,
        isSoldOut: s.isSoldOut ?? false,
        experienceTypes: types,
        ticketingUrl: s.ticketingUrl ?? s.deeplinkUrl ?? null,
        seatMapUrl: s.seatMapUrl ?? null,
        isReservedSeating: s.isReservedSeating ?? false,
      })
    );
  }
  return out;
}

/**
 * All showtimes for a film at a theatre, grouped by date (YYYY-MM-DD), in a
 * SINGLE upstream call. Only dates that ACTUALLY have >=1 session are included.
 *
 * This is the reliable "is the movie really playable on this date" signal.
 * Cineplex's /dates/bookable endpoint lists far-future placeholder dates for
 * films that aren't really out yet (with no showtimes behind them), which is
 * what caused false "new date" alerts — so we key everything off real sessions.
 */
export async function fetchFilmShowtimesByDate(
  filmId: number,
  locationId: number
): Promise<Map<string, ShowSession[]>> {
  const raw = (await cineplex(
    `showtimes?language=en&filmId=${filmId}&locationId=${locationId}`
  )) as RawTheatreShowtimes[];

  const byDate = new Map<string, ShowSession[]>();
  for (const theatre of Array.isArray(raw) ? raw : []) {
    for (const d of theatre.dates ?? []) {
      const date = (d.startDate ?? "").slice(0, 10);
      if (!date) continue;
      for (const movie of d.movies ?? []) {
        if (movie.id !== filmId) continue;
        for (const exp of movie.experiences ?? []) {
          const parsed = parseExperience(exp);
          if (parsed.length === 0) continue;
          const arr = byDate.get(date) ?? [];
          arr.push(...parsed);
          byDate.set(date, arr);
        }
      }
    }
  }

  // Sort each date's sessions chronologically.
  for (const arr of byDate.values()) {
    arr.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  }
  return byDate;
}

/** Sorted list of dates (YYYY-MM-DD) that have real showtimes for a film. */
export async function fetchShowtimeDates(filmId: number, locationId: number): Promise<string[]> {
  const byDate = await fetchFilmShowtimesByDate(filmId, locationId);
  return [...byDate.keys()].sort();
}

/**
 * Flattened, normalized showtimes for a single film + theatre + date.
 * Each session carries its experience format(s) (IMAX / UltraAVX / Recliner…).
 */
export async function fetchShowtimes(
  filmId: number,
  locationId: number,
  date: string // YYYY-MM-DD
): Promise<ShowSession[]> {
  const byDate = await fetchFilmShowtimesByDate(filmId, locationId);
  return byDate.get(date) ?? [];
}
