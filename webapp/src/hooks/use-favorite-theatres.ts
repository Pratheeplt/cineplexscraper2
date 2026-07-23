import { useCallback, useSyncExternalStore } from "react";

// Shared, persistent set of favorite theatre IDs. Backed by localStorage and
// an in-memory subscriber list so favoriting on the Theatres tab instantly
// updates the Movies tab (and other tabs / browser tabs) without a reload.
const KEY = "cineplex.favoriteTheatres";
const listeners = new Set<() => void>();

function read(): number[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

// Cached snapshot — useSyncExternalStore needs a stable reference until changed.
let snapshot: number[] = read();

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

function write(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore write failures
  }
  emit();
}

// Replace local favorite theatre IDs with the backend's copy WITHOUT pushing
// back to the server. Used on app load so favorites follow the user across
// every device — the backend store is the single source of truth.
export function hydrateFavoriteTheatres(ids: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore write failures
  }
  emit();
}

export function useFavoriteTheatres() {
  const favorites = useSyncExternalStore(subscribe, () => snapshot);

  const toggle = useCallback((id: number) => {
    const cur = read();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
