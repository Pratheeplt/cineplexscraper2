import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { existsSync } from "node:fs";
import "./env";
import { sampleRouter } from "./routes/sample";
import { cineplexRouter } from "./routes/cineplex";
import { notifyRouter } from "./routes/notify";
import { logger } from "hono/logger";
import { startScheduler } from "./lib/scheduler";

const app = new Hono();

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

app.use(
  "*",
  cors({
    origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
    credentials: true,
  })
);

// Logging — goes to stdout so it's visible at the container level (docker logs).
app.use("*", logger());

// Health check endpoint
app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/sample", sampleRouter);
app.route("/api/cineplex", cineplexRouter);
app.route("/api/notify", notifyRouter);

// In production (single container) the backend also serves the built webapp.
// STATIC_DIR points at the compiled Vite output (e.g. /app/webapp/dist).
const STATIC_DIR = process.env.STATIC_DIR;
if (STATIC_DIR && existsSync(STATIC_DIR)) {
  console.log(`[static] serving webapp from ${STATIC_DIR}`);
  app.use("/*", serveStatic({ root: STATIC_DIR }));
  // SPA fallback: any non-API, non-file route returns index.html.
  app.get("*", serveStatic({ path: "index.html", root: STATIC_DIR }));
}

const port = Number(process.env.PORT) || 3000;

// Kick off the background notification scheduler.
startScheduler();

console.log(`🎬 Cineplex Scraper backend listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
