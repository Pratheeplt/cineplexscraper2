import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Calendar, Film, MapPin } from "lucide-react";
import type { Movie, Theatre } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TheatreCombobox, ALL_THEATRES } from "./TheatreCombobox";
import { DateChips } from "./DateChips";
import { ShowtimeList } from "./ShowtimeList";
import { ErrorState } from "./StateViews";

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

function fetchDates(filmId: number, locationId: string): Promise<string[]> {
  return api.get<string[]>(`/api/cineplex/dates?filmId=${filmId}&locationId=${locationId}`);
}

function releaseDateLabel(date?: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  movie: Movie;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Theatre selected in MoviesTab, or null when "All theatres" is active.
  defaultLocationId?: string | null;
};

export function MovieDetailDialog({ movie, open, onOpenChange, defaultLocationId }: Props) {
  const isMobile = useIsMobile();

  const body = (
    <MovieDetailBody movie={movie} open={open} defaultLocationId={defaultLocationId} />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[90vh] overflow-y-auto rounded-t-2xl border-border"
        >
          <SheetTitle className="sr-only">{movie.name}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="sr-only">{movie.name}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function MovieDetailBody({
  movie,
  open,
  defaultLocationId,
}: {
  movie: Movie;
  open: boolean;
  defaultLocationId?: string | null;
}) {
  const [locationId, setLocationId] = useState<string>(defaultLocationId ?? ALL_THEATRES);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Keep the picker in sync with the theatre chosen in MoviesTab when reopened.
  useEffect(() => {
    if (open) setLocationId(defaultLocationId ?? ALL_THEATRES);
  }, [open, defaultLocationId]);

  const { data: theatres } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  const hasTheatre = locationId !== ALL_THEATRES;

  const {
    data: dates,
    isLoading: datesLoading,
    isError: datesError,
    error: datesErr,
    refetch: refetchDates,
  } = useQuery({
    queryKey: ["cineplex", "dates", movie.id, locationId],
    queryFn: () => fetchDates(movie.id, locationId),
    enabled: open && hasTheatre,
  });

  const dateList = useMemo(() => dates ?? [], [dates]);

  // Auto-select the first bookable date whenever the date list changes.
  useEffect(() => {
    if (dateList.length === 0) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate((prev) => (prev && dateList.includes(prev) ? prev : dateList[0]));
  }, [dateList]);

  const fullReleaseDate = releaseDateLabel(movie.releaseDate);
  const hasPoster = Boolean(movie.mediumPosterImageUrl);

  return (
    <div className="flex flex-col gap-5">
      {/* Header: poster + meta */}
      <div className="flex gap-4">
        <div className="aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-28">
          {hasPoster ? (
            <img
              src={movie.mediumPosterImageUrl ?? ""}
              alt={movie.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="h-7 w-7 text-primary/60" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="font-display text-xl font-bold leading-tight text-foreground">
            {movie.name}
          </h2>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {movie.runtimeInMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {movie.runtimeInMinutes} min
              </span>
            ) : null}
            {fullReleaseDate ? (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fullReleaseDate}
              </span>
            ) : null}
          </div>

          {movie.genres.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {movie.genres.slice(0, 4).map((genre) => (
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
      </div>

      {/* Theatre selector */}
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Theatre
        </span>
        <TheatreCombobox
          theatres={theatres ?? []}
          value={locationId}
          onChange={(v) => setLocationId(v)}
        />
      </div>

      {/* Dates + showtimes */}
      {!hasTheatre ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Choose a theatre to see dates &amp; showtimes.
        </div>
      ) : datesLoading ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[54px] w-[68px] shrink-0 rounded-lg" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[70px] w-[128px] rounded-lg" />
            ))}
          </div>
        </div>
      ) : datesError ? (
        <ErrorState message={(datesErr as Error)?.message} onRetry={() => refetchDates()} />
      ) : dateList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No bookable dates at this theatre.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DateChips dates={dateList} selected={selectedDate} onSelect={setSelectedDate} />
          {selectedDate ? (
            <ShowtimeList filmId={movie.id} locationId={locationId} date={selectedDate} />
          ) : null}
        </div>
      )}
    </div>
  );
}
