import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Armchair, LayoutGrid } from "lucide-react";
import type { ShowSession } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatTime, groupSessions, isPremiumFormat } from "./showtime-utils";
import { ErrorState, EmptyState } from "./StateViews";

function fetchShowtimes(filmId: number, locationId: string, date: string): Promise<ShowSession[]> {
  return api.get<ShowSession[]>(
    `/api/cineplex/showtimes?filmId=${filmId}&locationId=${locationId}&date=${date}`
  );
}

type Props = {
  filmId: number;
  locationId: string;
  date: string;
};

export function ShowtimeList({ filmId, locationId, date }: Props) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cineplex", "showtimes", filmId, locationId, date],
    queryFn: () => fetchShowtimes(filmId, locationId, date),
  });

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[70px] w-[128px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />;
  }

  const sessions = groupSessions(data ?? []);

  if (sessions.length === 0) {
    return <EmptyState message="No showtimes for this date." />;
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {sessions.map((s) => (
        <ShowtimeCard key={s.sessionId} session={s} />
      ))}
    </div>
  );
}

function ShowtimeCard({ session }: { session: ShowSession }) {
  const soldOut = session.isSoldOut;
  const hasLink = Boolean(session.ticketingUrl) && !soldOut;
  // Reserved-seating sessions expose an official seat-map preview page.
  const seatMapUrl = session.isReservedSeating ? session.seatMapUrl : null;
  const canPreviewSeats = Boolean(seatMapUrl) && !soldOut;

  return (
    <div
      className={cn(
        "flex min-w-[132px] flex-col gap-1.5 rounded-lg border p-2.5 transition-colors",
        soldOut
          ? "border-border/60 bg-secondary/40 opacity-70"
          : "border-border bg-card hover:border-primary/60"
      )}
    >
      {/* Time — clicking it goes straight to Cineplex booking. */}
      {hasLink ? (
        <a
          href={session.ticketingUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 hover:text-primary"
        >
          <span className="text-base font-bold leading-none">
            {formatTime(session.startDateTime)}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      ) : (
        <span className="text-base font-bold leading-none text-foreground">
          {formatTime(session.startDateTime)}
        </span>
      )}

      {session.experienceTypes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {session.experienceTypes.map((fmt) => (
            <Badge
              key={fmt}
              variant="outline"
              className={cn(
                "px-1.5 py-0 text-[10px] font-semibold",
                isPremiumFormat(fmt)
                  ? "border-transparent bg-primary/15 text-primary"
                  : "border-border/80 text-muted-foreground"
              )}
            >
              {fmt}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {session.auditorium ? <span>{session.auditorium}</span> : null}
        {soldOut ? (
          <span className="font-medium text-destructive">Sold out</span>
        ) : session.seatsRemaining != null ? (
          <span className="inline-flex items-center gap-1">
            <Armchair className="h-3 w-3" />
            {session.seatsRemaining} left
          </span>
        ) : null}
      </div>

      {canPreviewSeats ? (
        <a
          href={seatMapUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <LayoutGrid className="h-3 w-3" />
          Preview seats
        </a>
      ) : null}
    </div>
  );
}
