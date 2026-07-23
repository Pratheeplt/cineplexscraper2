import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import type { Movie } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MovieCard } from "./MovieCard";
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

export function MoviesTab() {
  const [filter, setFilter] = useState<MovieFilter>("all");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["cineplex", "movies", filter],
    queryFn: () => fetchMovies(filter),
  });

  const movies = data ?? [];

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

      {isLoading ? (
        <MovieGridSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : movies.length === 0 ? (
        <EmptyState message="No movies found for this filter." />
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
