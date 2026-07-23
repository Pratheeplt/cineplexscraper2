import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Theatre } from "../../../../backend/src/types";
import type { FavoriteTheatre } from "@/lib/notifyApi";
import { api } from "@/lib/api";
import { notifyApi } from "@/lib/notifyApi";
import { useFavoriteMovies } from "@/hooks/use-favorite-movies";
import { useFavoriteTheatres } from "@/hooks/use-favorite-theatres";

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

// Always-mounted, renders nothing. Keeps the backend's favorites store in sync
// with the browser's localStorage-backed favorites so the background scheduler
// can watch favorite movies across favorite theatres.
//
// Favorite MOVIES already mirror to the backend inside the hook's write(), but
// we also push them once on mount here in case the backend was reset while the
// browser still had them stored locally.
//
// Favorite THEATRES only store IDs locally (to keep MoviesTab's number[] API),
// so here we resolve their names from the shared theatres query and PUT the
// full { theatreId, theatreName }[] whenever the resolved list changes.
export function FavoritesSync() {
  const { favorites: favoriteTheatreIds } = useFavoriteTheatres();
  const { favorites: favoriteMovies } = useFavoriteMovies();

  const { data: theatres } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  // Push favorite movies once on mount (backend-reset recovery).
  const pushedMoviesOnMount = useRef(false);
  useEffect(() => {
    if (pushedMoviesOnMount.current) return;
    pushedMoviesOnMount.current = true;
    void notifyApi.setFavoriteMovies(favoriteMovies).catch(() => {});
    // Intentionally run only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync favorite theatres whenever the resolved list changes. Dedup so we
  // don't PUT an identical payload repeatedly.
  const lastTheatresKey = useRef<string | null>(null);
  useEffect(() => {
    // Wait until theatres data is available so we can resolve names.
    if (!theatres || theatres.length === 0) return;

    const byId = new Map(theatres.map((t) => [t.theatreId, t.theatreName]));
    const resolved: FavoriteTheatre[] = favoriteTheatreIds
      .map((id) => {
        const name = byId.get(id);
        return name ? { theatreId: id, theatreName: name } : null;
      })
      .filter((t): t is FavoriteTheatre => t !== null);

    const key = JSON.stringify(
      [...resolved].sort((a, b) => a.theatreId - b.theatreId)
    );
    if (key === lastTheatresKey.current) return;
    lastTheatresKey.current = key;

    void notifyApi.setFavoriteTheatres(resolved).catch(() => {});
  }, [theatres, favoriteTheatreIds]);

  return null;
}
