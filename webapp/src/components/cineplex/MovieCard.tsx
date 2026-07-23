import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Calendar, Film, ExternalLink, Bell, Ticket, MapPin, Heart } from "lucide-react";
import type { Movie } from "../../../../backend/src/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFavoriteMovies } from "@/hooks/use-favorite-movies";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PosterDatesOverlay } from "./PosterDatesOverlay";
import { MovieDetailDialog } from "./MovieDetailDialog";

// Full readable release date, e.g. "Jul 31, 2026". Null if unparseable.
function releaseDateLabel(date?: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function MovieCard({
  movie,
  theatreName = null,
  locationId = null,
}: {
  movie: Movie;
  theatreName?: string | null;
  // Selected theatre id (string) when a specific theatre is chosen, else null.
  locationId?: string | null;
}) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isFavorite, toggle } = useFavoriteMovies();
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const hasPoster = Boolean(movie.mediumPosterImageUrl) && !imgFailed;
  const fullReleaseDate = releaseDateLabel(movie.releaseDate);
  const favorited = isFavorite(movie.id);

  const handleFavorite = (e: React.MouseEvent) => {
    // Don't open the detail modal (or the Cineplex link) when favoriting.
    e.preventDefault();
    e.stopPropagation();
    toggle({
      filmId: movie.id,
      filmName: movie.name,
      posterUrl: movie.mediumPosterImageUrl ?? null,
    });
  };

  const handleNotify = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/?tab=notify&filmId=${movie.id}`);
  };

  const handleExternal = (e: React.MouseEvent) => {
    // Open the Cineplex page without opening the detail modal.
    e.stopPropagation();
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen(true);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left",
          "transition-all duration-300 hover:border-primary/60 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.5)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        )}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-secondary">
          {hasPoster ? (
            <img
              src={movie.mediumPosterImageUrl ?? ""}
              alt={movie.name}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary to-background p-4 text-center">
              <Film className="h-8 w-8 text-primary/60" />
              <span className="font-display text-lg leading-tight text-foreground/80">
                {movie.name}
              </span>
            </div>
          )}

          <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
            {movie.isNowPlaying ? (
              <Badge className="bg-primary text-primary-foreground shadow">Now Playing</Badge>
            ) : null}
            {movie.isComingSoon ? (
              <Badge className="bg-accent text-accent-foreground shadow">Coming Soon</Badge>
            ) : null}
            {movie.hasAdvanceTickets ? (
              <Badge className="gap-1 bg-blue-600 text-white shadow hover:bg-blue-600">
                <Ticket className="h-3 w-3" />
                Advance tickets
              </Badge>
            ) : null}
          </div>

          {/* Favorite (heart) toggle — always visible, top-right. */}
          <button
            type="button"
            onClick={handleFavorite}
            aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={favorited}
            className={cn(
              "absolute right-2 top-2 z-20 rounded-full bg-background/70 p-1.5 backdrop-blur transition-colors hover:bg-background",
              favorited ? "text-primary" : "text-foreground"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", favorited && "fill-current")} />
          </button>

          {/* Real anchor button: opens Cineplex without triggering the modal. */}
          {movie.detailPageUrl ? (
            <a
              href={movie.detailPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleExternal}
              aria-label="Open on Cineplex"
              className="absolute right-11 top-2 z-20 rounded-full bg-background/70 p-1.5 opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover:opacity-100"
            >
              <ExternalLink className="h-3.5 w-3.5 text-foreground" />
            </a>
          ) : null}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />

          {/* Desktop-only hover overlay listing bookable dates. */}
          {!isMobile ? (
            <PosterDatesOverlay filmId={movie.id} locationId={locationId} active={hovered} />
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="line-clamp-2 font-semibold leading-snug text-foreground" title={movie.name}>
            {movie.name}
          </h3>

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {movie.runtimeInMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {movie.runtimeInMinutes} min
              </span>
            ) : null}
            {fullReleaseDate ? (
              <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                <Calendar className="h-3 w-3" />
                {fullReleaseDate}
              </span>
            ) : null}
          </div>

          {theatreName ? (
            <span className="inline-flex items-center gap-1 text-xs text-primary">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{theatreName}</span>
            </span>
          ) : null}

          {movie.genres.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {movie.genres.slice(0, 3).map((genre) => (
                <Badge
                  key={genre}
                  variant="outline"
                  className="border-border/80 px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleNotify}
            className="mt-1 w-full gap-1.5 border-primary/40 text-xs hover:bg-primary/10 hover:text-primary"
          >
            <Bell className="h-3.5 w-3.5" />
            Notify me
          </Button>
        </div>
      </div>

      <MovieDetailDialog
        movie={movie}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        defaultLocationId={locationId}
      />
    </>
  );
}
