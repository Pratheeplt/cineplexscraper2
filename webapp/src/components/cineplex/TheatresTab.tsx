import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Search, ExternalLink, Star } from "lucide-react";
import type { Theatre } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFavoriteTheatres } from "@/hooks/use-favorite-theatres";
import { ListSkeleton, ErrorState, EmptyState } from "./StateViews";

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

function TheatreCard({
  theatre,
  isFavorite,
  onToggleFavorite,
}: {
  theatre: Theatre;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const location = [theatre.city, theatre.provinceCode].filter(Boolean).join(", ");

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors",
        isFavorite ? "border-amber-400/60" : "border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-foreground">{theatre.theatreName}</h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          className="h-8 w-8 shrink-0 hover:bg-amber-400/10"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            )}
          />
        </Button>
      </div>

      {location ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-accent">
          <MapPin className="h-3.5 w-3.5" />
          {location}
        </p>
      ) : null}

      {theatre.address ? (
        <p className="text-sm text-muted-foreground">
          {theatre.address}
          {theatre.postalCode ? ` · ${theatre.postalCode}` : ""}
        </p>
      ) : null}

      {theatre.theatreUrl ? (
        <a
          href={theatre.theatreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View on Cineplex
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

export function TheatresTab() {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const { favorites, toggle, isFavorite } = useFavoriteTheatres();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  const theatres = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = theatres;
    if (favoritesOnly) list = list.filter((t) => favorites.includes(t.theatreId));
    if (q) {
      list = list.filter((t) =>
        [t.theatreName, t.city, t.provinceCode, t.address]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [theatres, search, favoritesOnly, favorites]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city or address…"
              className="pl-9"
            />
          </div>

          <Button
            type="button"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((v) => !v)}
            className={cn(
              "gap-2",
              favoritesOnly && "bg-amber-500 text-white hover:bg-amber-500/90"
            )}
          >
            <Star className={cn("h-4 w-4", favoritesOnly && "fill-white")} />
            Favorites
            {favorites.length > 0 ? (
              <span className="rounded-full bg-background/20 px-1.5 text-xs">
                {favorites.length}
              </span>
            ) : null}
          </Button>
        </div>

        <p className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          {isLoading ? (
            "Loading…"
          ) : (
            <span>
              <span className="font-semibold text-foreground">{filtered.length}</span>
              {search || favoritesOnly ? ` of ${theatres.length}` : ""}{" "}
              {filtered.length === 1 ? "theatre" : "theatres"}
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            favoritesOnly && favorites.length === 0
              ? "No favorite theatres yet. Tap the star on a theatre to add it."
              : search
                ? "No theatres match your search."
                : "No theatres available."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((theatre) => (
            <TheatreCard
              key={theatre.theatreId}
              theatre={theatre}
              isFavorite={isFavorite(theatre.theatreId)}
              onToggleFavorite={() => toggle(theatre.theatreId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
