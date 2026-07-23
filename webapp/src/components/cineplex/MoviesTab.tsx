import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Globe } from "lucide-react";
import type { Movie, Theatre } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovieCard } from "./MovieCard";
import { MovieGridSkeleton, ErrorState, EmptyState } from "./StateViews";

type MovieFilter = "all" | "now-playing" | "coming-soon";

const FILTERS: { value: MovieFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "now-playing", label: "Now Playing" },
  { value: "coming-soon", label: "Coming Soon" },
];

const ALL_THEATRES = "all";

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
  const [filter, setFilter] = useState<MovieFilter>("all");
  const [theatreId, setTheatreId] = useState<string>(ALL_THEATRES);
  const [hideInternational, setHideInternational] = useState<boolean>(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["cineplex", "movies", filter],
    queryFn: () => fetchMovies(filter),
  });

  const { data: theatres } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  // Film IDs playing at the selected theatre (only fetched when one is picked).
  const { data: theatreFilmIds, isFetching: isFetchingTheatre } = useQuery({
    queryKey: ["cineplex", "theatre-films", theatreId],
    queryFn: () => fetchTheatreFilmIds(theatreId),
    enabled: theatreId !== ALL_THEATRES,
  });

  const movies = useMemo(() => {
    let list = data ?? [];

    if (hideInternational) list = list.filter(isEnglish);

    if (theatreId !== ALL_THEATRES && theatreFilmIds) {
      const allowed = new Set(theatreFilmIds);
      list = list.filter((m) => allowed.has(m.id));
    }

    return [...list].sort(byReleaseDateAsc);
  }, [data, hideInternational, theatreId, theatreFilmIds]);

  const filteringByTheatre = theatreId !== ALL_THEATRES;
  // While a theatre's film list is still loading, show skeletons not a wrong count.
  const theatrePending = filteringByTheatre && isFetchingTheatre && !theatreFilmIds;

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

      {/* Secondary filters: theatre + hide international */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="theatre-filter" className="shrink-0 text-sm text-muted-foreground">
            Theatre
          </Label>
          <Select value={theatreId} onValueChange={setTheatreId}>
            <SelectTrigger id="theatre-filter" className="w-full sm:w-[280px]">
              <SelectValue placeholder="All theatres" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value={ALL_THEATRES}>All theatres</SelectItem>
              {(theatres ?? []).map((t) => (
                <SelectItem key={t.theatreId} value={String(t.theatreId)}>
                  {t.theatreName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="hide-intl" className="cursor-pointer text-sm text-muted-foreground">
            Hide international movies
          </Label>
          <Switch
            id="hide-intl"
            checked={hideInternational}
            onCheckedChange={setHideInternational}
          />
        </div>
      </div>

      {isLoading || theatrePending ? (
        <MovieGridSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : movies.length === 0 ? (
        <EmptyState
          message={
            filteringByTheatre
              ? "No movies match this theatre and filter."
              : "No movies found for this filter."
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}
