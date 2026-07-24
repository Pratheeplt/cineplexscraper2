import { useCallback, useSyncExternalStore } from "react";
import type { WatchedMovie } from "@/lib/notifyApi";
import { notifyApi } from "@/lib/notifyApi";

// Shared, persistent list of movies the user has already watched. Watched
// movies are hidden from the main movie list until "unwatched". Backed by
// localStorage + an in-memory subscriber list (so toggling on any card instantly
// updates every card / tab) and mirrored to the backend so it follows the user
// across devices. Same design as use-favorite-movies.
const KEY = "cineplex.watchedMovies";
const listeners = new Set<() => void>();

function read(): WatchedMovie[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is WatchedMovie =>
        x != null && typeof x === "object" && typeof (x as WatchedMovie).filmId === "number"
    );
  } catch {
    return [];
  }
}

// Cached snapshot — useSyncExternalStore needs a stable reference until changed.
let snapshot: WatchedMovie[] = read();

function emit() {
  snapshot = read();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Keep other browser tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) emit();
  });
}

function write(movies: WatchedMovie[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(movies));
  } catch {
    // ignore write failures
  }
  emit();
  // Mirror to the backend. Fire-and-forget; UI never blocks and errors are ignored.
  void notifyApi.setWatchedMovies(movies).catch(() => {});
}

// Replace local watched list with the backend's copy WITHOUT pushing back.
// Used on app load so the watched list follows the user across every device.
export function hydrateWatchedMovies(movies: WatchedMovie[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(movies));
  } catch {
    // ignore write failures
  }
  emit();
}

export function useWatchedMovies() {
  const watched = useSyncExternalStore(subscribe, () => snapshot);

  const toggle = useCallback((movie: WatchedMovie) => {
    const cur = read();
    const exists = cur.some((m) => m.filmId === movie.filmId);
    write(exists ? cur.filter((m) => m.filmId !== movie.filmId) : [...cur, movie]);
  }, []);

  const isWatched = useCallback(
    (filmId: number) => watched.some((m) => m.filmId === filmId),
    [watched]
  );

  return { watched, toggle, isWatched, count: watched.length };
}
