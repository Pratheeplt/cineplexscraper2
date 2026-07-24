import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Theatre } from "../../../../backend/src/types";
import type { FavoriteMovie, FavoriteTheatre, WatchedMovie } from "@/lib/notifyApi";
import { api } from "@/lib/api";
import { notifyApi } from "@/lib/notifyApi";
import { useFavoriteTheatres, hydrateFavoriteTheatres } from "@/hooks/use-favorite-theatres";
import { useFavoriteMovies, hydrateFavoriteMovies } from "@/hooks/use-favorite-movies";
import { useWatchedMovies, hydrateWatchedMovies } from "@/hooks/use-watched-movies";

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

// Stable key for a set of favorite theatres, independent of ordering.
function theatresKey(list: FavoriteTheatre[]): string {
  return JSON.stringify([...list].sort((a, b) => a.theatreId - b.theatreId));
}

// Always-mounted, renders nothing. Makes the backend's favorites store the
// single source of truth so favorites follow the user across every device.
//
// On load we reconcile ONCE: merge this device's local favorites with the
// backend's copy (union), write the merged set into local, and push it back so
// the backend holds everything. Only AFTER this reconciliation do we push
// further local changes — otherwise a fresh device with empty localStorage
// would overwrite the backend with nothing.
//
// Favorite MOVIES store full objects (the scheduler needs name + poster).
// Favorite THEATRES store only IDs locally, so we resolve their names from the
// shared theatres query before pushing the full { theatreId, theatreName }[].
export function FavoritesSync() {
  const { favorites: favoriteTheatreIds } = useFavoriteTheatres();
  const { favorites: favoriteMovies } = useFavoriteMovies();
  const { watched: watchedMovies } = useWatchedMovies();

  const { data: theatres } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  const { data: serverFavorites } = useQuery({
    queryKey: ["notify", "favorites"],
    queryFn: () => notifyApi.getFavorites(),
  });

  const { data: serverWatched } = useQuery({
    queryKey: ["notify", "watched"],
    queryFn: () => notifyApi.getWatchedMovies(),
  });

  // Has the local store been reconciled with the backend copy yet?
  const hydrated = useRef(false);
  // Last theatre payload pushed to the backend — dedupes redundant PUTs.
  const lastTheatresKey = useRef<string | null>(null);
  // Has the watched list been reconciled with the backend copy yet?
  const watchedHydrated = useRef(false);

  // Reconcile once: union of local + backend becomes the truth on both sides.
  useEffect(() => {
    if (hydrated.current) return;
    if (!serverFavorites) return;
    // Need theatre names to represent any local-only theatre IDs on the backend.
    if (!theatres || theatres.length === 0) return;
    hydrated.current = true;

    const nameById = new Map(theatres.map((t) => [t.theatreId, t.theatreName]));

    // Movies: union by filmId (backend entries win on conflict).
    const movieMap = new Map<number, FavoriteMovie>();
    for (const m of favoriteMovies) movieMap.set(m.filmId, m);
    for (const m of serverFavorites.movies) movieMap.set(m.filmId, m);
    const mergedMovies = [...movieMap.values()];

    // Theatres: union by theatreId.
    const theatreMap = new Map<number, FavoriteTheatre>();
    for (const t of serverFavorites.theatres) theatreMap.set(t.theatreId, t);
    for (const id of favoriteTheatreIds) {
      if (theatreMap.has(id)) continue;
      const name = nameById.get(id);
      if (name) theatreMap.set(id, { theatreId: id, theatreName: name });
    }
    const mergedTheatres = [...theatreMap.values()];

    // Write the merged set into this device's local store.
    hydrateFavoriteMovies(mergedMovies);
    hydrateFavoriteTheatres(mergedTheatres.map((t) => t.theatreId));

    // Push back only when we actually added something the backend was missing.
    if (mergedMovies.length !== serverFavorites.movies.length) {
      void notifyApi.setFavoriteMovies(mergedMovies).catch(() => {});
    }
    lastTheatresKey.current = theatresKey(mergedTheatres);
    if (mergedTheatres.length !== serverFavorites.theatres.length) {
      void notifyApi.setFavoriteTheatres(mergedTheatres).catch(() => {});
    }
  }, [serverFavorites, theatres, favoriteMovies, favoriteTheatreIds]);

  // Reconcile the watched list once: union of local + backend on both sides.
  useEffect(() => {
    if (watchedHydrated.current) return;
    if (!serverWatched) return;
    watchedHydrated.current = true;

    const movieMap = new Map<number, WatchedMovie>();
    for (const m of watchedMovies) movieMap.set(m.filmId, m);
    for (const m of serverWatched) movieMap.set(m.filmId, m);
    const merged = [...movieMap.values()];

    hydrateWatchedMovies(merged);
    // Only push back when we added something the backend was missing.
    if (merged.length !== serverWatched.length) {
      void notifyApi.setWatchedMovies(merged).catch(() => {});
    }
  }, [serverWatched, watchedMovies]);

  // Push favorite theatres to the backend whenever the resolved list changes.
  // Suppressed until reconciliation completes so we never clobber the server.
  useEffect(() => {
    if (!hydrated.current) return;
    if (!theatres || theatres.length === 0) return;

    const byId = new Map(theatres.map((t) => [t.theatreId, t.theatreName]));
    const resolved: FavoriteTheatre[] = favoriteTheatreIds
      .map((id) => {
        const name = byId.get(id);
        return name ? { theatreId: id, theatreName: name } : null;
      })
      .filter((t): t is FavoriteTheatre => t !== null);

    const key = theatresKey(resolved);
    if (key === lastTheatresKey.current) return;
    lastTheatresKey.current = key;

    void notifyApi.setFavoriteTheatres(resolved).catch(() => {});
  }, [theatres, favoriteTheatreIds]);

  return null;
}
