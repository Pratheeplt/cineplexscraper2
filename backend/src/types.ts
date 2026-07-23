import { z } from "zod";

export const MovieSchema = z.object({
  id: z.number(),
  name: z.string(),
  releaseDate: z.string().nullable().optional(),
  runtimeInMinutes: z.number().nullable().optional(),
  filmUrl: z.string().nullable().optional(),
  mediumPosterImageUrl: z.string().nullable().optional(),
  largePosterImageUrl: z.string().nullable().optional(),
  genres: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  distributor: z.string().nullable().optional(),
  detailPageUrl: z.string().nullable().optional(),
  isNowPlaying: z.boolean().default(false),
  isComingSoon: z.boolean().default(false),
  hasShowtimes: z.boolean().default(false),
});
export type Movie = z.infer<typeof MovieSchema>;

export const TheatreSchema = z.object({
  theatreId: z.number(),
  theatreName: z.string(),
  shortTheatreName: z.string().nullable().optional(),
  theatreUrl: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  provinceCode: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});
export type Theatre = z.infer<typeof TheatreSchema>;

// ---------------------------------------------------------------------------
// Showtimes
// ---------------------------------------------------------------------------

// A single screening. experienceTypes carries the format(s): IMAX, UltraAVX,
// Recliner, etc. (comes from the parent "experience" grouping on Cineplex).
export const ShowSessionSchema = z.object({
  sessionId: z.number(),
  startDateTime: z.string(), // local, e.g. "2026-07-23T12:30:00"
  auditorium: z.string().nullable().optional(),
  seatsRemaining: z.number().nullable().optional(),
  isSoldOut: z.boolean().default(false),
  experienceTypes: z.array(z.string()).default([]),
  ticketingUrl: z.string().nullable().optional(),
});
export type ShowSession = z.infer<typeof ShowSessionSchema>;

// ---------------------------------------------------------------------------
// Notify — a "watch" is one film + one theatre + one target date the user
// wants to be alerted about when new showtimes appear.
// ---------------------------------------------------------------------------

export const WatchSchema = z.object({
  id: z.string(),
  filmId: z.number(),
  filmName: z.string(),
  posterUrl: z.string().nullable().optional(),
  locationId: z.number(),
  theatreName: z.string(),
  date: z.string(), // target date, YYYY-MM-DD
  createdAt: z.string(),
  lastCheckedAt: z.string().nullable().optional(),
  // Latest bookable dates seen for this film+theatre (for the dashboard)
  bookableDates: z.array(z.string()).default([]),
  // Most recent showtimes snapshot for the target date
  sessions: z.array(ShowSessionSchema).default([]),
});
export type Watch = z.infer<typeof WatchSchema>;

export const CreateWatchSchema = z.object({
  filmId: z.number(),
  filmName: z.string(),
  posterUrl: z.string().nullable().optional(),
  locationId: z.number(),
  theatreName: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});
export type CreateWatch = z.infer<typeof CreateWatchSchema>;

// A history entry recorded when a brand-new showtime is detected.
export const HistoryEntrySchema = z.object({
  id: z.string(),
  watchId: z.string(),
  filmName: z.string(),
  theatreName: z.string(),
  date: z.string(),
  startDateTime: z.string(),
  experienceTypes: z.array(z.string()).default([]),
  auditorium: z.string().nullable().optional(),
  seatsRemaining: z.number().nullable().optional(),
  detectedAt: z.string(),
});
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

export const SettingsSchema = z.object({
  enabled: z.boolean().default(true),
  intervalMinutes: z.number().default(30),
  telegramBotToken: z.string().default(""),
  telegramChatId: z.string().default(""),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = SettingsSchema.partial();
export type UpdateSettings = z.infer<typeof UpdateSettingsSchema>;

// Preset check intervals offered in the UI (minutes).
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
