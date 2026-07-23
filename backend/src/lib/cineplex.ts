// Shared Cineplex API client + normalizers.
// Used by both the HTTP routes and the background scheduler.
import { ShowSessionSchema, type ShowSession } from "../types";

const CINEPLEX_KEY = "dcdac5601d864addbc2675a2e96cb1f8"; // public key from cineplex.com website JS

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

/** Bookable dates (YYYY-MM-DD) for a film at a theatre. */
export async function fetchBookableDates(filmId: number, locationId: number): Promise<string[]> {
  const raw = (await cineplex(`dates/bookable?filmId=${filmId}&locationId=${locationId}`)) as unknown;
  const list = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : [];
  // Normalize "2026-07-22T00:00:00" -> "2026-07-22"
  return list.map((d) => d.slice(0, 10));
}

type RawSession = {
  vistaSessionId?: number;
  showStartDateTime?: string;
  auditorium?: string | null;
  seatsRemaining?: number | null;
  isSoldOut?: boolean;
  ticketingUrl?: string | null;
  deeplinkUrl?: string | null;
};
type RawExperience = { experienceTypes?: string[]; sessions?: RawSession[] };
type RawMovie = { id?: number; experiences?: RawExperience[] };
type RawDate = { startDate?: string; movies?: RawMovie[] };
type RawTheatreShowtimes = { theatreId?: number; dates?: RawDate[] };

/**
 * Flattened, normalized showtimes for a single film + theatre + date.
 * Each session carries its experience format(s) (IMAX / UltraAVX / Recliner…).
 */
export async function fetchShowtimes(
  filmId: number,
  locationId: number,
  date: string // YYYY-MM-DD
): Promise<ShowSession[]> {
  const raw = (await cineplex(
    `showtimes?language=en&filmId=${filmId}&locationId=${locationId}&date=${date}`
  )) as RawTheatreShowtimes[];

  const sessions: ShowSession[] = [];
  for (const theatre of Array.isArray(raw) ? raw : []) {
    for (const d of theatre.dates ?? []) {
      // Only keep the requested date (API sometimes returns neighbours)
      if (d.startDate && d.startDate.slice(0, 10) !== date) continue;
      for (const movie of d.movies ?? []) {
        if (movie.id !== filmId) continue;
        for (const exp of movie.experiences ?? []) {
          const types = exp.experienceTypes ?? [];
          for (const s of exp.sessions ?? []) {
            if (typeof s.vistaSessionId !== "number" || !s.showStartDateTime) continue;
            sessions.push(
              ShowSessionSchema.parse({
                sessionId: s.vistaSessionId,
                startDateTime: s.showStartDateTime,
                auditorium: s.auditorium ?? null,
                seatsRemaining: s.seatsRemaining ?? null,
                isSoldOut: s.isSoldOut ?? false,
                experienceTypes: types,
                ticketingUrl: s.ticketingUrl ?? s.deeplinkUrl ?? null,
              })
            );
          }
        }
      }
    }
  }

  sessions.sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));
  return sessions;
}
