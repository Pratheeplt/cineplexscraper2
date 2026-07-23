import { Hono } from "hono";
import { MovieSchema, TheatreSchema, type Movie, type Theatre } from "../types";

const CINEPLEX_KEY = "dcdac5601d864addbc2675a2e96cb1f8"; // public key from cineplex.com website JS

async function cineplex(path: string): Promise<unknown> {
  const res = await fetch(`https://apis.cineplex.com/prod/cpx/theatrical/api/v1/${path}`, {
    headers: {
      "Ocp-Apim-Subscription-Key": CINEPLEX_KEY,
      "accept": "*/*",
      "origin": "https://www.cineplex.com",
      "referer": "https://www.cineplex.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Cineplex ${path} -> ${res.status}`);
  return res.json();
}

const cineplexRouter = new Hono();

function upstreamError(e: unknown) {
  const message = e instanceof Error ? e.message : "Unknown Cineplex upstream error";
  return { error: { message, code: "CINEPLEX_UPSTREAM" as const } };
}

// GET /api/cineplex -> movies
cineplexRouter.get("/", async (c) => {
  try {
    const filter = c.req.query("filter");
    const raw = (await cineplex("movies?language=en")) as { items?: unknown[] };
    const items = Array.isArray(raw.items) ? raw.items : [];

    const movies: Movie[] = items.map((item) => MovieSchema.parse(item));

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

// GET /api/cineplex/dates?filmId=..&locationId=..
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
    const raw = (await cineplex(
      `dates/bookable?filmId=${filmId}&locationId=${locationId}`
    )) as unknown;
    const dates: string[] = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : [];
    return c.json({ data: dates });
  } catch (e) {
    return c.json(upstreamError(e), 502);
  }
});

export { cineplexRouter };
