import { Hono } from "hono";
import { TheatreSchema, type Theatre } from "../types";
import {
  cineplex,
  fetchMovies,
  fetchShowtimeDates,
  fetchShowtimes,
  fetchTheatreFilmIds,
} from "../lib/cineplex";

const cineplexRouter = new Hono();

function upstreamError(e: unknown) {
  const message = e instanceof Error ? e.message : "Unknown Cineplex upstream error";
  return { error: { message, code: "CINEPLEX_UPSTREAM" as const } };
}

// GET /api/cineplex -> movies
cineplexRouter.get("/", async (c) => {
  try {
    const filter = c.req.query("filter");
    const movies = await fetchMovies();

    let filtered = movies;
    if (filter === "now-playing") filtered = movies.filter((m) => m.isNowPlaying);
    else if (filter === "coming-soon") filtered = movies.filter((m) => m.isComingSoon);

    return c.json({ data: filtered });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

// GET /api/cineplex/theatres
type RawTheatre = {
  theatreId: number;
  theatreName: string;
  shortTheatreName?: string | null;
  theatreUrl?: string | null;
  location?: {
    geoLocation?: { latitude?: number | null; longitude?: number | null } | null;
    address?: string | null;
    city?: string | null;
    provinceCode?: string | null;
    postalCode?: string | null;
  } | null;
};

cineplexRouter.get("/theatres", async (c) => {
  try {
    const raw = (await cineplex("theatres?language=en")) as {
      favouriteTheatres?: RawTheatre[];
      nearbyTheatres?: RawTheatre[];
      otherTheatres?: RawTheatre[];
    };

    const all: RawTheatre[] = [
      ...(raw.favouriteTheatres ?? []),
      ...(raw.nearbyTheatres ?? []),
      ...(raw.otherTheatres ?? []),
    ];

    const theatres: Theatre[] = all.map((t) =>
      TheatreSchema.parse({
        theatreId: t.theatreId,
        theatreName: t.theatreName,
        shortTheatreName: t.shortTheatreName ?? null,
        theatreUrl: t.theatreUrl ?? null,
        city: t.location?.city ?? null,
        provinceCode: t.location?.provinceCode ?? null,
        address: t.location?.address ?? null,
        postalCode: t.location?.postalCode ?? null,
        latitude: t.location?.geoLocation?.latitude ?? null,
        longitude: t.location?.geoLocation?.longitude ?? null,
      })
    );

    theatres.sort((a, b) => a.theatreName.localeCompare(b.theatreName));

    return c.json({ data: theatres });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

// GET /api/cineplex/theatre-films?locationId=.. -> number[] of film IDs at that theatre
cineplexRouter.get("/theatre-films", async (c) => {
  const locationId = c.req.query("locationId");
  if (!locationId || !/^\d+$/.test(locationId)) {
    return c.json(
      {
        error: {
          message: "locationId is required and must be numeric",
          code: "INVALID_QUERY" as const,
        },
      },
      400
    );
  }

  try {
    const filmIds = await fetchTheatreFilmIds(Number(locationId));
    return c.json({ data: filmIds });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

// GET /api/cineplex/dates?filmId=..&locationId=..
// Only dates that actually have showtimes — a movie with placeholder future
// dates but no shows yet returns nothing (it isn't really bookable).
cineplexRouter.get("/dates", async (c) => {
  const filmId = c.req.query("filmId");
  const locationId = c.req.query("locationId");

  if (!filmId || !locationId || !/^\d+$/.test(filmId) || !/^\d+$/.test(locationId)) {
    return c.json(
      {
        error: {
          message: "filmId and locationId are required numeric query params",
          code: "INVALID_QUERY" as const,
        },
      },
      400
    );
  }

  try {
    const dates = await fetchShowtimeDates(Number(filmId), Number(locationId));
    return c.json({ data: dates });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

// GET /api/cineplex/showtimes?filmId=..&locationId=..&date=YYYY-MM-DD
cineplexRouter.get("/showtimes", async (c) => {
  const filmId = c.req.query("filmId");
  const locationId = c.req.query("locationId");
  const date = c.req.query("date");

  if (
    !filmId ||
    !locationId ||
    !date ||
    !/^\d+$/.test(filmId) ||
    !/^\d+$/.test(locationId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return c.json(
      {
        error: {
          message: "filmId, locationId (numeric) and date (YYYY-MM-DD) are required",
          code: "INVALID_QUERY" as const,
        },
      },
      400
    );
  }

  try {
    const sessions = await fetchShowtimes(Number(filmId), Number(locationId), date);
    return c.json({ data: sessions });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

export { cineplexRouter };
