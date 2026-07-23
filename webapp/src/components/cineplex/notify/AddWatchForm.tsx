import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Building2, CalendarPlus, Plus } from "lucide-react";
import type { Movie, Theatre } from "../../../../../backend/src/types";
import { api } from "@/lib/api";
import { notifyApi } from "@/lib/notifyApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { EntityCombobox, type ComboOption } from "./EntityCombobox";

function todayISO(): string {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

interface AddWatchFormProps {
  preselectFilmId?: number | null;
  onPreselectConsumed?: () => void;
}

export function AddWatchForm({ preselectFilmId, onPreselectConsumed }: AddWatchFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [movieId, setMovieId] = useState<number | null>(null);
  const [theatreId, setTheatreId] = useState<number | null>(null);
  const [date, setDate] = useState<string>("");

  const { data: movies, isLoading: moviesLoading } = useQuery({
    queryKey: ["cineplex", "movies", "all"],
    queryFn: () => api.get<Movie[]>("/api/cineplex"),
  });
  const { data: theatres, isLoading: theatresLoading } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: () => api.get<Theatre[]>("/api/cineplex/theatres"),
  });

  const movieOptions: ComboOption[] = useMemo(
    () =>
      (movies ?? []).map((m) => ({
        id: m.id,
        label: m.name,
        sublabel: [m.genres.slice(0, 2).join(", "), m.isComingSoon ? "Coming soon" : ""]
          .filter(Boolean)
          .join(" · "),
      })),
    [movies]
  );

  const theatreOptions: ComboOption[] = useMemo(
    () =>
      (theatres ?? []).map((t) => ({
        id: t.theatreId,
        label: t.theatreName,
        sublabel: [t.city, t.provinceCode].filter(Boolean).join(", "),
      })),
    [theatres]
  );

  // Preselect a movie when arriving from a "Notify me" button.
  useEffect(() => {
    if (preselectFilmId && movies?.some((m) => m.id === preselectFilmId)) {
      setMovieId(preselectFilmId);
      onPreselectConsumed?.();
    }
  }, [preselectFilmId, movies, onPreselectConsumed]);

  const selectedMovie = movies?.find((m) => m.id === movieId) ?? null;
  const selectedTheatre = theatres?.find((t) => t.theatreId === theatreId) ?? null;

  const create = useMutation({
    mutationFn: () => {
      if (!selectedMovie || !selectedTheatre || !date) {
        throw new Error("Pick a film, a theatre and a date.");
      }
      return notifyApi.createWatch({
        filmId: selectedMovie.id,
        filmName: selectedMovie.name,
        posterUrl: selectedMovie.mediumPosterImageUrl ?? null,
        locationId: selectedTheatre.theatreId,
        theatreName: selectedTheatre.theatreName,
        date,
      });
    },
    onSuccess: (watch) => {
      queryClient.invalidateQueries({ queryKey: ["notify", "watches"] });
      toast({
        title: "Now watching",
        description: `${watch.filmName} at ${watch.theatreName}. You'll be notified about new showtimes.`,
      });
      setMovieId(null);
      setTheatreId(null);
      setDate("");
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Couldn't add", description: (e as Error).message }),
  });

  const canSubmit = Boolean(movieId && theatreId && date) && !create.isPending;

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 shadow-[0_0_40px_-20px_hsl(var(--primary)/0.6)] sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <CalendarPlus className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Track a new film + theatre</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Film className="h-3.5 w-3.5" /> Film
          </Label>
          <EntityCombobox
            options={movieOptions}
            value={movieId}
            onSelect={(o) => setMovieId(o?.id ?? null)}
            placeholder="Select a film…"
            searchPlaceholder="Type a film name…"
            emptyText="No films match."
            loading={moviesLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Theatre
          </Label>
          <EntityCombobox
            options={theatreOptions}
            value={theatreId}
            onSelect={(o) => setTheatreId(o?.id ?? null)}
            placeholder="Select a theatre…"
            searchPlaceholder="Type a theatre or city…"
            emptyText="No theatres match."
            loading={theatresLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarPlus className="h-3.5 w-3.5" /> Date to watch
          </Label>
          <Input
            type="date"
            min={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="[color-scheme:dark]"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={() => create.mutate()} disabled={!canSubmit} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {create.isPending ? "Adding…" : "Notify me for this"}
        </Button>
      </div>
    </div>
  );
}
