import { useState } from "react";
import { Clock, Calendar, Film, ExternalLink } from "lucide-react";
import type { Movie } from "../../../../backend/src/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function releaseYear(date?: string | null): string | null {
  if (!date) return null;
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

export function MovieCard({ movie }: { movie: Movie }) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasPoster = Boolean(movie.mediumPosterImageUrl) && !imgFailed;
  const year = releaseYear(movie.releaseDate);

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

        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {movie.isNowPlaying ? (
            <Badge className="bg-primary text-primary-foreground shadow">Now Playing</Badge>
          ) : null}
          {movie.isComingSoon ? (
            <Badge className="bg-accent text-accent-foreground shadow">Coming Soon</Badge>
          ) : null}
        </div>

        {movie.detailPageUrl ? (
          <div className="absolute right-2 top-2 rounded-full bg-background/70 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            <ExternalLink className="h-3.5 w-3.5 text-foreground" />
          </div>
        ) : null}

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
          {year ? (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {year}
            </span>
          ) : null}
        </div>

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
      </div>
    </Wrapper>
  );
}
