// Persistent JSON store for the Notify feature.
// Data is written to DATA_DIR (default ./data) so it survives container restarts
// when that directory is mounted as a Docker volume.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import {
  SettingsSchema,
  WatchSchema,
  HistoryEntrySchema,
  type Settings,
  type Watch,
  type HistoryEntry,
} from "../types";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const FILE = join(DATA_DIR, "notify.json");
const HISTORY_CAP = 500;

// Default Telegram bot supplied by the user (t.me/cineplexscraperbot).
const DEFAULT_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8847611911:AAEXmXTMRNG8V3qUsVdZ0bPQZDk_I-lsBqQ";

interface StoreShape {
  settings: Settings;
  watches: Watch[];
  history: HistoryEntry[];
  // per-watch set of showtime sessionIds already seen (for new-showtime diffing)
  seen: Record<string, number[]>;
}

function defaults(): StoreShape {
  return {
    settings: SettingsSchema.parse({ telegramBotToken: DEFAULT_BOT_TOKEN }),
    watches: [],
    history: [],
    seen: {},
  };
}

let state: StoreShape = defaults();

function load(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(FILE)) {
      console.log(`[store] no existing data at ${FILE}, starting fresh`);
      persist();
      return;
    }
    const raw = JSON.parse(readFileSync(FILE, "utf8"));
    state = {
      settings: SettingsSchema.parse(raw.settings ?? {}),
      watches: Array.isArray(raw.watches)
        ? raw.watches.map((w: unknown) => WatchSchema.parse(w))
        : [],
      history: Array.isArray(raw.history)
        ? raw.history.map((h: unknown) => HistoryEntrySchema.parse(h))
        : [],
      seen: typeof raw.seen === "object" && raw.seen ? raw.seen : {},
    };
    // Ensure the default token is present if the user never customized it.
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
  return { ...state.settings };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  state.settings = SettingsSchema.parse({ ...state.settings, ...patch });
  persist();
  return getSettings();
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
