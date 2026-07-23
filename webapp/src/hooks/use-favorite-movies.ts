import { useCallback, useSyncExternalStore } from "react";
import type { FavoriteMovie } from "@/lib/notifyApi";
import { notifyApi } from "@/lib/notifyApi";

// Shared, persistent list of favorite movies. Backed by localStorage and an
// in-memory subscriber list so favoriting on any card instantly updates every
// other card / tab / browser tab without a reload. Unlike favorite theatres
// (which stores only IDs), we store FULL objects because the backend scheduler
// needs the film name + poster to build alerts.
const KEY = "cineplex.favoriteMovies";
const listeners = new Set<() => void>();

function read(): FavoriteMovie[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is FavoriteMovie =>
        x != null && typeof x === "object" && typeof (x as FavoriteMovie).filmId === "number"
    );
  } catch {
    return [];
  }
}

// Cached snapshot — useSyncExternalStore needs a stable reference until changed.
let snapshot: FavoriteMovie[] = read();

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

function write(movies: FavoriteMovie[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(movies));
  } catch {
    // ignore write failures
  }
  emit();
  // Mirror to the backend so the scheduler can watch these movies.
  // Fire-and-forget; UI never blocks on the sync and errors are ignored.
  void notifyApi.setFavoriteMovies(movies).catch(() => {});
}

// Replace local favorites with the backend's copy WITHOUT pushing back to the
// server. Used on app load so favorites follow the user across every device —
// the backend store is the single source of truth.
export function hydrateFavoriteMovies(movies: FavoriteMovie[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(movies));
  } catch {
    // ignore write failures
  }
  emit();
}

export function useFavoriteMovies() {
  const favorites = useSyncExternalStore(subscribe, () => snapshot);

  const toggle = useCallback((movie: FavoriteMovie) => {
    const cur = read();
    const exists = cur.some((m) => m.filmId === movie.filmId);
    write(exists ? cur.filter((m) => m.filmId !== movie.filmId) : [...cur, movie]);
  }, []);

  const isFavorite = useCallback(
    (filmId: number) => favorites.some((m) => m.filmId === filmId),
    [favorites]
  );

  return { favorites, toggle, isFavorite, count: favorites.length };
}
