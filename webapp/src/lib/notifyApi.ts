import { api } from "@/lib/api";
import type {
  Watch,
  HistoryEntry,
  ShowSession,
  ActivityEvent,
  FavoriteMovie,
  FavoriteTheatre,
  WatchedMovie,
} from "../../../backend/src/types";

export type {
  Watch,
  HistoryEntry,
  ShowSession,
  ActivityEvent,
  FavoriteMovie,
  FavoriteTheatre,
  WatchedMovie,
};

export interface NotifySettings {
  enabled: boolean;
  intervalMinutes: number;
  catalogEnabled: boolean;
  catalogIntervalMinutes: number;
  notifyAdvanceTickets: boolean;
  notifyFavoriteDates: boolean;
  hideInternational: boolean;
  hasBotToken: boolean;
  telegramChatId: string;
  telegramConnected: boolean;
}

// The settings fields the UI is allowed to change. Includes the two Telegram
// string secrets which are write-only from the client (never returned raw).
export type NotifySettingsPatch = Partial<
  Pick<
    NotifySettings,
    | "enabled"
    | "intervalMinutes"
    | "catalogEnabled"
    | "catalogIntervalMinutes"
    | "notifyAdvanceTickets"
    | "notifyFavoriteDates"
    | "hideInternational"
    | "telegramChatId"
  > & {
    telegramBotToken: string;
  }
>;

export interface Favorites {
  movies: FavoriteMovie[];
  theatres: FavoriteTheatre[];
}

// Preset check intervals offered in the UI (kept in sync with the backend).
export const INTERVAL_PRESETS = [
  { minutes: 5, label: "Every 5 minutes" },
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 180, label: "Every 3 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
] as const;

export interface CreateWatchInput {
  filmId: number;
  filmName: string;
  posterUrl?: string | null;
  locationId: number;
  theatreName: string;
  date: string; // YYYY-MM-DD
}

export const notifyApi = {
  listWatches: () => api.get<Watch[]>("/api/notify/watches"),
  createWatch: (input: CreateWatchInput) => api.post<Watch>("/api/notify/watches", input),
  deleteWatch: (id: string) => api.delete<{ id: string }>(`/api/notify/watches/${id}`),
  checkWatch: (id: string) =>
    api.post<{ watch: Watch; newCount: number }>(`/api/notify/watches/${id}/check`),
  checkNow: () => api.post<{ newCount: number; watches: Watch[] }>("/api/notify/check-now"),

  getHistory: (limit = 100) => api.get<HistoryEntry[]>(`/api/notify/history?limit=${limit}`),

  getActivity: (limit = 200) => api.get<ActivityEvent[]>(`/api/notify/activity?limit=${limit}`),
  scanNow: () =>
    api.post<{ newCount: number; activity: ActivityEvent[] }>("/api/notify/scan-now"),

  getSettings: () => api.get<NotifySettings>("/api/notify/settings"),
  updateSettings: (patch: NotifySettingsPatch) =>
    api.patch<NotifySettings>("/api/notify/settings", patch),

  connectTelegram: () =>
    api.post<{ telegramChatId: string; telegramConnected: boolean }>("/api/notify/telegram/connect"),
  testTelegram: () => api.post<{ sent: boolean }>("/api/notify/telegram/test"),

  getFavorites: () => api.get<Favorites>("/api/notify/favorites"),
  setFavoriteMovies: (movies: FavoriteMovie[]) =>
    api.put<Favorites>("/api/notify/favorites/movies", { movies }),
  setFavoriteTheatres: (theatres: FavoriteTheatre[]) =>
    api.put<Favorites>("/api/notify/favorites/theatres", { theatres }),

  getWatchedMovies: () => api.get<WatchedMovie[]>("/api/notify/watched"),
  setWatchedMovies: (movies: WatchedMovie[]) =>
    api.put<WatchedMovie[]>("/api/notify/watched", { movies }),
};
