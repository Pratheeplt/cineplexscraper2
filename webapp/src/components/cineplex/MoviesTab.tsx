import { useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Film, Globe, Ticket, Search, Star } from "lucide-react";
import type { Movie, Theatre } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useFavoriteTheatres } from "@/hooks/use-favorite-theatres";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MovieCard } from "./MovieCard";
import { TheatreCombobox, ALL_THEATRES } from "./TheatreCombobox";
import { MovieGridSkeleton, ErrorState, EmptyState } from "./StateViews";

type MovieFilter = "all" | "now-playing" | "coming-soon";

const FILTERS: { value: MovieFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "now-playing", label: "Now Playing" },
  { value: "coming-soon", label: "Coming Soon" },
];

function fetchMovies(filter: MovieFilter): Promise<Movie[]> {
  const query = filter === "all" ? "" : `?filter=${filter}`;
  return api.get<Movie[]>(`/api/cineplex${query}`);
}

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

function fetchTheatreFilmIds(locationId: string): Promise<number[]> {
  return api.get<number[]>(`/api/cineplex/theatre-films?locationId=${locationId}`);
}

// A film counts as "international" when its spoken language isn't English.
function isEnglish(movie: Movie): boolean {
  return (movie.language ?? "").trim().toLowerCase() === "english";
}

// Sort by release date, oldest → newest. Films without a date sink to the end.
function byReleaseDateAsc(a: Movie, b: Movie): number {
  const ta = a.releaseDate ? Date.parse(a.releaseDate) : NaN;
  const tb = b.releaseDate ? Date.parse(b.releaseDate) : NaN;
  const va = Number.isNaN(ta) ? Infinity : ta;
  const vb = Number.isNaN(tb) ? Infinity : tb;
  if (va !== vb) return va - vb;
  return a.name.localeCompare(b.name);
}

export function MoviesTab() {
  // Filters persist to localStorage so they're restored on the next visit.
  const [filter, setFilter] = usePersistentState<MovieFilter>("movies.filter", "all");
  const [theatreId, setTheatreId] = usePersistentState<string>("movies.theatreId", ALL_THEATRES);
  const [hideInternational, setHideInternational] = usePersistentState<boolean>(
    "movies.hideInternational",
    false
  );
  const [advanceOnly, setAdvanceOnly] = usePersistentState<boolean>("movies.advanceOnly", false);
  const [favoritesOnly, setFavoritesOnly] = usePersistentState<boolean>("movies.favoritesOnly", false);
  const [search, setSearch] = usePersistentState<string>("movies.search", "");

  const { favorites } = useFavoriteTheatres();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["cineplex", "movies", filter],
    queryFn: () => fetchMovies(filter),
  });

  const { data: theatres } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  // Film IDs playing at the single selected theatre (only when one is picked).
  const { data: theatreFilmIds, isFetching: isFetchingTheatre } = useQuery({
    queryKey: ["cineplex", "theatre-films", theatreId],
    queryFn: () => fetchTheatreFilmIds(theatreId),
    enabled: theatreId !== ALL_THEATRES,
  });

  // Film IDs for each favorite theatre (only when the favorites filter is on).
  const favQueries = useQueries({
    queries: favorites.map((id) => ({
      queryKey: ["cineplex", "theatre-films", String(id)],
      queryFn: () => fetchTheatreFilmIds(String(id)),
      enabled: favoritesOnly && favorites.length > 0,
    })),
  });

  const theatreList = theatres ?? [];
  const selectedTheatre = theatreList.find((t) => String(t.theatreId) === theatreId);

  const favFilmIds = favQueries.flatMap((q) => q.data ?? []);
  const favFilmKey = favoritesOnly ? [...favFilmIds].sort((a, b) => a - b).join(",") : "";
  const favLoading = favoritesOnly && favorites.length > 0 && favQueries.some((q) => q.isLoading);

  const movies = useMemo(() => {
    let list = data ?? [];

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));

    if (hideInternational) list = list.filter(isEnglish);
    if (advanceOnly) list = list.filter((m) => m.hasAdvanceTickets);

    if (theatreId !== ALL_THEATRES && theatreFilmIds) {
      const allowed = new Set(theatreFilmIds);
      list = list.filter((m) => allowed.has(m.id));
    }

    if (favoritesOnly && favorites.length > 0) {
      const allowed = new Set(favFilmIds);
      list = list.filter((m) => allowed.has(m.id));
    }

    return [...list].sort(byReleaseDateAsc);
    // favFilmKey stands in for favFilmIds (stable string of the same data).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data,
    search,
    hideInternational,
    advanceOnly,
    theatreId,
    theatreFilmIds,
    favoritesOnly,
    favorites,
    favFilmKey,
  ]);

  const filteringByTheatre = theatreId !== ALL_THEATRES;
  // While a theatre's film list is still loading, show skeletons not a wrong count.
  const theatrePending =
    (filteringByTheatre && isFetchingTheatre && !theatreFilmIds) || favLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as MovieFilter)}
          className="justify-start gap-1 rounded-lg border border-border bg-card p-1"
        >
          {FILTERS.map((f) => (
            <ToggleGroupItem
              key={f.value}
              value={f.value}
              className="rounded-md px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Film className="h-4 w-4 text-primary" />
          {isLoading ? (
            "Loading…"
          ) : (
            <span>
              <span className="font-semibold text-foreground">{movies.length}</span>{" "}
              {movies.length === 1 ? "movie" : "movies"}
              {isFetching ? " · refreshing…" : ""}
            </span>
          )}
        </p>
      </div>

      {/* Movie search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search movies by name…"
          className="pl-9"
        />
      </div>

      {/* Secondary filters: theatre search + toggles */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/50 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm text-muted-foreground">Theatre</Label>
            <TheatreCombobox theatres={theatreList} value={theatreId} onChange={setTheatreId} />
          </div>

          <div className="flex items-center gap-2 sm:pl-1">
            <Star className={cn("h-4 w-4", favoritesOnly ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            <Label htmlFor="fav-only" className="cursor-pointer whitespace-nowrap text-sm text-muted-foreground">
              Favorite theatres
            </Label>
            <Switch id="fav-only" checked={favoritesOnly} onCheckedChange={setFavoritesOnly} />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="hide-intl" className="cursor-pointer text-sm text-muted-foreground">
              Hide international
            </Label>
            <Switch
              id="hide-intl"
              checked={hideInternational}
              onCheckedChange={setHideInternational}
            />
          </div>

          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-blue-500" />
            <Label htmlFor="advance-only" className="cursor-pointer text-sm text-muted-foreground">
              Advance tickets only
            </Label>
            <Switch id="advance-only" checked={advanceOnly} onCheckedChange={setAdvanceOnly} />
          </div>
        </div>
      </div>

      {favoritesOnly && favorites.length === 0 ? (
        <EmptyState message="You haven't favorited any theatres yet. Go to the Theatres tab and tap the star to add some." />
      ) : isLoading || theatrePending ? (
        <MovieGridSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : movies.length === 0 ? (
        <EmptyState
          message={
            search
              ? "No movies match your search and filters."
              : filteringByTheatre || favoritesOnly
                ? "No movies match your selected theatres and filters."
                : "No movies found for this filter."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              theatreName={selectedTheatre?.theatreName ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
