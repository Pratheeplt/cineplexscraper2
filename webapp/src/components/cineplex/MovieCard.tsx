import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Calendar, Film, ExternalLink, Bell, Ticket, MapPin, Languages } from "lucide-react";
import type { Movie } from "../../../../backend/src/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
}: {
  movie: Movie;
  theatreName?: string | null;
}) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);
  const hasPoster = Boolean(movie.mediumPosterImageUrl) && !imgFailed;
  const fullReleaseDate = releaseDateLabel(movie.releaseDate);

  const handleNotify = (e: React.MouseEvent) => {
    // Don't trigger the outer link to the Cineplex detail page.
    e.preventDefault();
    e.stopPropagation();
    navigate(`/?tab=notify&filmId=${movie.id}`);
  };

  const Wrapper: React.ElementType = movie.detailPageUrl ? "a" : "div";
  const wrapperProps = movie.detailPageUrl
    ? { href: movie.detailPageUrl, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        "transition-all duration-300 hover:border-primary/60 hover:shadow-[0_8px_30px_-8px_hsl(var(--primary)/0.5)]",
        movie.detailPageUrl && "cursor-pointer"
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

        <div className="absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-col items-start gap-1">
          {movie.isNowPlaying ? (
            <Badge className="bg-primary text-primary-foreground shadow">Now Playing</Badge>
          ) : null}
          {movie.isComingSoon ? (
            <Badge className="bg-accent text-accent-foreground shadow">Coming Soon</Badge>
          ) : null}
          {/* Banner sits right underneath the Coming Soon badge. */}
          {movie.hasAdvanceTickets ? (
            <Badge className="gap-1 bg-blue-600 text-white shadow hover:bg-blue-600">
              <Ticket className="h-3 w-3" />
              Advance tickets
            </Badge>
          ) : null}
        </div>

        {movie.detailPageUrl ? (
          <div className="absolute right-2 top-2 z-10 rounded-full bg-background/70 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-3.5 w-3.5 text-foreground" />
          </div>
        ) : null}

        {/* Hover overlay: translucent panel with the movie's details. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 flex flex-col gap-2 overflow-y-auto bg-background/85 p-3 backdrop-blur-sm",
            "opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          )}
        >
          <h4 className="font-display text-base leading-tight text-foreground">{movie.name}</h4>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {fullReleaseDate ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fullReleaseDate}
              </span>
            ) : null}
            {movie.runtimeInMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {movie.runtimeInMinutes} min
              </span>
            ) : null}
            {movie.language ? (
              <span className="inline-flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {movie.language}
              </span>
            ) : null}
          </div>

          {movie.genres.length > 0 ? (
            <p className="text-xs leading-relaxed text-foreground/80">
              {movie.genres.join(" · ")}
            </p>
          ) : null}

          {movie.distributor ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="text-foreground/70">Distributor:</span> {movie.distributor}
            </p>
          ) : null}

          <p className="mt-auto text-[11px] font-medium text-primary">
            {movie.detailPageUrl ? "Click to view full details on Cineplex →" : ""}
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
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
          {/* Full release date shown for every movie. */}
          {fullReleaseDate ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
              <Calendar className="h-3 w-3" />
              {fullReleaseDate}
            </span>
          ) : null}
        </div>

        {/* When filtering by a theatre, show which theatre this movie plays at. */}
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
    </Wrapper>
  );
}
