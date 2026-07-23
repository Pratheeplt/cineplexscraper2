// Persistent JSON store for the Notify feature.
// Data is written to DATA_DIR (default ./data) so it survives container restarts
// when that directory is mounted as a Docker volume.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  SettingsSchema,
  WatchSchema,
  HistoryEntrySchema,
  ActivityEventSchema,
  FavoritesSchema,
  FavoriteMovieSchema,
  FavoriteTheatreSchema,
  type Settings,
  type Watch,
  type HistoryEntry,
  type ActivityEvent,
  type Favorites,
  type FavoriteMovie,
  type FavoriteTheatre,
} from "../types";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const FILE = join(DATA_DIR, "notify.json");
const HISTORY_CAP = 500;
const ACTIVITY_CAP = 500;

// A snapshot of one film from the last catalog scan, used to detect changes.
export interface CatalogEntry {
  name: string;
  hasAdvanceTickets: boolean;
  releaseDate: string | null;
  isNowPlaying: boolean;
}

// Default Telegram bot supplied by the user (t.me/cineplexscraperbot).
const DEFAULT_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8847611911:AAEXmXTMRNG8V3qUsVdZ0bPQZDk_I-lsBqQ";

interface StoreShape {
  settings: Settings;
  watches: Watch[];
  history: HistoryEntry[];
  // per-watch set of showtime sessionIds already seen (for new-showtime diffing)
  seen: Record<string, number[]>;
  // last catalog scan snapshot, keyed by filmId (string), for change detection
  catalog: Record<string, CatalogEntry>;
  // detected catalog-level changes, newest first (Activity tab)
  activity: ActivityEvent[];
  // favorite movies + theatres (for the new-bookable-date alert feature)
  favorites: Favorites;
  // per favorite film+theatre pair, the last set of bookable dates seen (for
  // diffing). Keyed by `${filmId}_${theatreId}`. Absence = never checked.
  favSeenDates: Record<string, string[]>;
}

function defaults(): StoreShape {
  return {
    settings: SettingsSchema.parse({ telegramBotToken: DEFAULT_BOT_TOKEN }),
    watches: [],
    history: [],
    seen: {},
    catalog: {},
    activity: [],
    favorites: FavoritesSchema.parse({}),
    favSeenDates: {},
  };
}

let state: StoreShape = defaults();

/**
 * Read and parse the store file, returning a fully-validated StoreShape.
 * Returns null if the file is missing or unparseable. Never logs, never throws.
 * Parses ALL collections defensively so a partially-corrupt file still loads.
 */
function readFromDisk(): StoreShape | null {
  try {
    if (!existsSync(FILE)) return null;
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    return {
      settings: SettingsSchema.parse(raw.settings ?? {}),
      watches: Array.isArray(raw.watches)
        ? raw.watches.map((w: unknown) => WatchSchema.parse(w))
        : [],
      history: Array.isArray(raw.history)
        ? raw.history.map((h: unknown) => HistoryEntrySchema.parse(h))
        : [],
      seen: typeof raw.seen === "object" && raw.seen ? raw.seen : {},
      catalog: typeof raw.catalog === "object" && raw.catalog ? raw.catalog : {},
      activity: Array.isArray(raw.activity)
        ? raw.activity.map((a: unknown) => ActivityEventSchema.parse(a))
        : [],
      favorites: FavoritesSchema.parse(raw.favorites ?? {}),
      favSeenDates:
        typeof raw.favSeenDates === "object" && raw.favSeenDates ? raw.favSeenDates : {},
    };
  } catch {
    return null;
  }
}

/**
 * Read-through sync: refresh the in-memory `state` from disk before every op.
 * Because Bun is single-threaded and store ops are synchronous, a
 * read-modify-write against the file is atomic and cannot clobber concurrent
 * fields — even when `bun --hot` keeps multiple stale copies of this module
 * alive. Silent: never throws, never logs. In production (single instance) it
 * simply re-reads what this instance last wrote.
 */
function syncFromDisk(): void {
  try {
    const d = readFromDisk();
    if (d) state = d;
  } catch {
    // never throw — fall back to current in-memory state
  }
}

function load(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const d = readFromDisk();
    if (!d) {
      console.log(`[store] no existing data at ${FILE}, starting fresh`);
      persist();
      return;
    }
    state = d;
    // Ensure the default token is present if the user never customized it.
    // (Only seeded at startup — a user-saved token must always win.)
    if (!state.settings.telegramBotToken) state.settings.telegramBotToken = DEFAULT_BOT_TOKEN;
    console.log(
      `[store] loaded ${state.watches.length} watch(es), ${state.history.length} history entries from ${FILE}`
    );
  } catch (e) {
    console.error(`[store] failed to load ${FILE}, starting fresh:`, e);
    state = defaults();
  }
}

function persist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    renameSync(tmp, FILE); // atomic replace
  } catch (e) {
    console.error(`[store] failed to persist ${FILE}:`, e);
  }
}

load();

// ---- Settings -------------------------------------------------------------
export function getSettings(): Settings {
  syncFromDisk();
  return { ...state.settings };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  syncFromDisk();
  state.settings = SettingsSchema.parse({ ...state.settings, ...patch });
  persist();
  return { ...state.settings };
}

// ---- Watches --------------------------------------------------------------
export function getWatches(): Watch[] {
  return state.watches.map((w) => ({ ...w }));
}

export function getWatch(id: string): Watch | undefined {
  const w = state.watches.find((x) => x.id === id);
  return w ? { ...w } : undefined;
}

export function addWatch(w: Watch): Watch {
  state.watches.unshift(w);
  persist();
  return { ...w };
}

/** True if a watch for this film+theatre+date already exists. */
export function watchExists(filmId: number, locationId: number, date: string): boolean {
  return state.watches.some(
    (w) => w.filmId === filmId && w.locationId === locationId && w.date === date
  );
}

export function updateWatch(id: string, patch: Partial<Watch>): Watch | undefined {
  const idx = state.watches.findIndex((w) => w.id === id);
  const current = idx === -1 ? undefined : state.watches[idx];
  if (!current) return undefined;
  const updated: Watch = { ...current, ...patch };
  state.watches[idx] = updated;
  persist();
  return { ...updated };
}

export function deleteWatch(id: string): boolean {
  const before = state.watches.length;
  state.watches = state.watches.filter((w) => w.id !== id);
  delete state.seen[id];
  const removed = state.watches.length !== before;
  if (removed) persist();
  return removed;
}

// ---- Seen showtime ids (new-showtime diffing) -----------------------------
export function getSeen(watchId: string): Set<number> {
  return new Set(state.seen[watchId] ?? []);
}

export function setSeen(watchId: string, ids: Iterable<number>): void {
  state.seen[watchId] = Array.from(new Set(ids));
  persist();
}

// ---- History --------------------------------------------------------------
export function getHistory(limit = 100): HistoryEntry[] {
  return state.history.slice(0, limit).map((h) => ({ ...h }));
}

export function addHistory(entries: HistoryEntry[]): void {
  if (entries.length === 0) return;
  state.history.unshift(...entries);
  if (state.history.length > HISTORY_CAP) state.history.length = HISTORY_CAP;
  persist();
}

// ---- Catalog snapshot (change detection) ----------------------------------
export function getCatalog(): Record<string, CatalogEntry> {
  return state.catalog;
}

export function isCatalogInitialized(): boolean {
  return Object.keys(state.catalog).length > 0;
}

export function setCatalog(catalog: Record<string, CatalogEntry>): void {
  state.catalog = catalog;
  persist();
}

// ---- Activity feed --------------------------------------------------------
export function getActivity(limit = 200): ActivityEvent[] {
  return state.activity.slice(0, limit).map((a) => ({ ...a }));
}

export function addActivity(entries: ActivityEvent[]): void {
  if (entries.length === 0) return;
  state.activity.unshift(...entries);
  if (state.activity.length > ACTIVITY_CAP) state.activity.length = ACTIVITY_CAP;
  persist();
}

// ---- Favorites ------------------------------------------------------------
export function getFavorites(): Favorites {
  return {
    movies: state.favorites.movies.map((m) => ({ ...m })),
    theatres: state.favorites.theatres.map((t) => ({ ...t })),
  };
}

export function setFavoriteMovies(movies: FavoriteMovie[]): Favorites {
  state.favorites.movies = movies.map((m) => FavoriteMovieSchema.parse(m));
  persist();
  return getFavorites();
}

export function setFavoriteTheatres(theatres: FavoriteTheatre[]): Favorites {
  state.favorites.theatres = theatres.map((t) => FavoriteTheatreSchema.parse(t));
  persist();
  return getFavorites();
}

// ---- Favorite bookable-date snapshots (new-date diffing) ------------------
// Returns undefined when this film+theatre pair has never been checked, so
// callers can distinguish "baseline" from a genuinely empty date set.
export function getFavSeenDates(key: string): string[] | undefined {
  return state.favSeenDates[key];
}

export function setFavSeenDates(key: string, dates: string[]): void {
  state.favSeenDates[key] = dates;
  persist();
}
