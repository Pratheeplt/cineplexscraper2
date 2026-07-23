import { useQuery } from "@tanstack/react-query";
import { Calendar, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { shortDateLabel } from "./showtime-utils";

function fetchDates(filmId: number, locationId: string): Promise<string[]> {
  return api.get<string[]>(`/api/cineplex/dates?filmId=${filmId}&locationId=${locationId}`);
}

type Props = {
  filmId: number;
  locationId: string | null;
  // Whether the poster is currently hovered — drives both the fetch and the reveal.
  active: boolean;
};

const MAX_CHIPS = 6;

// Semi-transparent panel revealed on poster hover. Lists the next several
// bookable dates for the selected theatre, or a hint when none is selected.
export function PosterDatesOverlay({ filmId, locationId, active }: Props) {
  const hasTheatre = Boolean(locationId);

  const { data, isLoading } = useQuery({
    queryKey: ["cineplex", "dates", filmId, locationId],
    queryFn: () => fetchDates(filmId, locationId as string),
    enabled: active && hasTheatre,
  });

  const dates = data ?? [];
  const shown = dates.slice(0, MAX_CHIPS);
  const extra = dates.length - shown.length;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-3",
        "bg-gradient-to-t from-black/90 via-black/70 to-transparent",
        "translate-y-2 opacity-0 transition-all duration-300 ease-out",
        "group-hover:translate-y-0 group-hover:opacity-100"
      )}
    >
      {!hasTheatre ? (
        <p className="text-xs font-medium text-white/70">Select a theatre to see dates</p>
      ) : isLoading ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-white/80">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading dates…
        </span>
      ) : dates.length === 0 ? (
        <p className="text-xs font-medium text-white/70">No bookable dates</p>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
            <Calendar className="h-3 w-3" />
            Bookable dates
          </span>
          <div className="flex flex-wrap gap-1">
            {shown.map((date) => (
              <span
                key={date}
                className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
              >
                {shortDateLabel(date)}
              </span>
            ))}
            {extra > 0 ? (
              <span className="rounded-md bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                +{extra} more
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
