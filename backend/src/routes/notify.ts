import { Hono } from "hono";
import { z } from "zod";
import {
  CreateWatchSchema,
  UpdateSettingsSchema,
  WatchSchema,
  FavoriteMovieSchema,
  FavoriteTheatreSchema,
  type Watch,
} from "../types";
import {
  getSettings,
  updateSettings,
  getWatches,
  getWatch,
  addWatch,
  deleteWatch,
  watchExists,
  getHistory,
  getActivity,
  getFavorites,
  setFavoriteMovies,
  setFavoriteTheatres,
} from "../lib/store";
import {
  checkWatch,
  checkAllWatches,
  restartScheduler,
  scanCatalogNow,
} from "../lib/scheduler";
import { sendTelegram, detectChatId } from "../lib/telegram";
import { isEnglishLanguage } from "../lib/cineplex";

const notifyRouter = new Hono();

function badRequest(message: string, code = "INVALID_QUERY") {
  return { error: { message, code } };
}

let watchSeq = 0;
function newWatchId(): string {
  watchSeq += 1;
  return `w_${Date.now().toString(36)}_${watchSeq.toString(36)}`;
}

// ---- Watches --------------------------------------------------------------

// GET /api/notify/watches
notifyRouter.get("/watches", (c) => {
  return c.json({ data: getWatches() });
});

// POST /api/notify/watches
notifyRouter.post("/watches", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CreateWatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.issues[0]?.message ?? "Invalid watch"), 400);
  }
  const input = parsed.data;

  if (watchExists(input.filmId, input.locationId, input.date)) {
    return c.json(
      badRequest("You're already watching this film at this theatre for that date.", "DUPLICATE"),
      409
    );
  }

  const watch: Watch = WatchSchema.parse({
    id: newWatchId(),
    filmId: input.filmId,
    filmName: input.filmName,
    posterUrl: input.posterUrl ?? null,
    locationId: input.locationId,
    theatreName: input.theatreName,
    date: input.date,
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    bookableDates: [],
    sessions: [],
  });
  addWatch(watch);
  console.log(`[notify] added watch ${watch.id}: "${watch.filmName}" @ ${watch.theatreName} on ${watch.date}`);

  // Immediate baseline check (populates dates + current showtimes, no alert).
  try {
    await checkWatch(watch.id, false);
  } catch (e) {
    console.error(`[notify] baseline check failed for ${watch.id}:`, (e as Error).message);
  }

  return c.json({ data: getWatch(watch.id) ?? watch });
});

// DELETE /api/notify/watches/:id
notifyRouter.delete("/watches/:id", (c) => {
  const id = c.req.param("id");
  const removed = deleteWatch(id);
  if (!removed) return c.json(badRequest("Watch not found", "NOT_FOUND"), 404);
  console.log(`[notify] deleted watch ${id}`);
  return c.json({ data: { id } });
});

// POST /api/notify/watches/:id/check  — check one watch now
notifyRouter.post("/watches/:id/check", async (c) => {
  const id = c.req.param("id");
  if (!getWatch(id)) return c.json(badRequest("Watch not found", "NOT_FOUND"), 404);
  try {
    const fresh = await checkWatch(id, true);
    return c.json({ data: { watch: getWatch(id), newCount: fresh.length } });
  } catch (e) {
    return c.json(badRequest((e as Error).message, "CHECK_FAILED"), 502);
  }
});

// POST /api/notify/check-now — check all watches now
notifyRouter.post("/check-now", async (c) => {
  try {
    const newCount = await checkAllWatches(true);
    return c.json({ data: { newCount, watches: getWatches() } });
  } catch (e) {
    return c.json(badRequest((e as Error).message, "CHECK_FAILED"), 502);
  }
});

// ---- History --------------------------------------------------------------

// GET /api/notify/history?limit=100
notifyRouter.get("/history", (c) => {
  const limit = Number(c.req.query("limit")) || 100;
  return c.json({ data: getHistory(limit) });
});

// ---- Activity (catalog changes) -------------------------------------------

// GET /api/notify/activity?limit=200
notifyRouter.get("/activity", (c) => {
  const limit = Number(c.req.query("limit")) || 200;
  // When "hide international" is on, drop non-English events from the feed.
  // Events with no recorded language (e.g. favourite-date alerts) are kept.
  if (getSettings().hideInternational) {
    const filtered = getActivity(500).filter(
      (e) => e.language == null || isEnglishLanguage(e.language)
    );
    return c.json({ data: filtered.slice(0, limit) });
  }
  return c.json({ data: getActivity(limit) });
});

// POST /api/notify/scan-now — run a catalog scan immediately
notifyRouter.post("/scan-now", async (c) => {
  try {
    const newCount = await scanCatalogNow(true);
    return c.json({ data: { newCount, activity: getActivity(200) } });
  } catch (e) {
    return c.json(badRequest((e as Error).message, "SCAN_FAILED"), 502);
  }
});

// ---- Favorites ------------------------------------------------------------

// GET /api/notify/favorites
notifyRouter.get("/favorites", (c) => {
  return c.json({ data: getFavorites() });
});

// PUT /api/notify/favorites/movies
notifyRouter.put("/favorites/movies", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ movies: z.array(FavoriteMovieSchema) }).safeParse(body);
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.issues[0]?.message ?? "Invalid favorites"), 400);
  }
  setFavoriteMovies(parsed.data.movies);
  return c.json({ data: getFavorites() });
});

// PUT /api/notify/favorites/theatres
notifyRouter.put("/favorites/theatres", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ theatres: z.array(FavoriteTheatreSchema) }).safeParse(body);
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.issues[0]?.message ?? "Invalid favorites"), 400);
  }
  setFavoriteTheatres(parsed.data.theatres);
  return c.json({ data: getFavorites() });
});

// ---- Settings -------------------------------------------------------------

// Public projection of settings — never leaks the raw bot token.
function publicSettings() {
  const s = getSettings();
  return {
    enabled: s.enabled,
    intervalMinutes: s.intervalMinutes,
    catalogEnabled: s.catalogEnabled,
    catalogIntervalMinutes: s.catalogIntervalMinutes,
    notifyAdvanceTickets: s.notifyAdvanceTickets,
    notifyFavoriteDates: s.notifyFavoriteDates,
    hideInternational: s.hideInternational,
    hasBotToken: Boolean(s.telegramBotToken),
    telegramChatId: s.telegramChatId,
    telegramConnected: Boolean(s.telegramBotToken && s.telegramChatId),
  };
}

// GET /api/notify/settings
notifyRouter.get("/settings", (c) => {
  return c.json({ data: publicSettings() });
});

// PATCH /api/notify/settings
notifyRouter.patch("/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(badRequest(parsed.error.issues[0]?.message ?? "Invalid settings"), 400);
  }
  updateSettings(parsed.data);
  restartScheduler(); // interval / enabled (either loop) may have changed
  return c.json({ data: publicSettings() });
});

// ---- Telegram -------------------------------------------------------------

// POST /api/notify/telegram/connect — auto-detect chat id from /start message
notifyRouter.post("/telegram/connect", async (c) => {
  const { telegramBotToken } = getSettings();
  if (!telegramBotToken) return c.json(badRequest("No bot token configured", "NO_TOKEN"), 400);
  try {
    const chatId = await detectChatId(telegramBotToken);
    if (!chatId) {
      return c.json(
        badRequest(
          "No chat found. Open Telegram, message the bot (t.me/cineplexscraperbot) with /start, then try again.",
          "NO_CHAT"
        ),
        404
      );
    }
    updateSettings({ telegramChatId: chatId });
    console.log(`[notify] Telegram connected to chat ${chatId}`);
    return c.json({ data: { telegramChatId: chatId, telegramConnected: true } });
  } catch (e) {
    return c.json(badRequest((e as Error).message, "TELEGRAM_ERROR"), 502);
  }
});

// POST /api/notify/telegram/test — send a test message
notifyRouter.post("/telegram/test", async (c) => {
  try {
    await sendTelegram("✅ Cineplex Scraper is connected. You'll get alerts here when new showtimes appear.");
    return c.json({ data: { sent: true } });
  } catch (e) {
    return c.json(badRequest((e as Error).message, "TELEGRAM_ERROR"), 502);
  }
});

export { notifyRouter };
