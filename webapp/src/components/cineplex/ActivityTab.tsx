import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Ticket,
  Sparkles,
  PlayCircle,
  CalendarClock,
  CalendarPlus,
  RefreshCw,
  Film,
} from "lucide-react";
import { Armchair, Clock } from "lucide-react";
import type { ActivityEvent, ShowSession } from "@/lib/notifyApi";
import { notifyApi } from "@/lib/notifyApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatTime, experienceClass } from "./notify/format";
import { ListSkeleton, ErrorState, EmptyState } from "./StateViews";

// Visual style + label per activity type.
const TYPE_META: Record<
  ActivityEvent["type"],
  { label: string; icon: typeof Ticket; className: string }
> = {
  advance_tickets: {
    label: "Advance tickets",
    icon: Ticket,
    className: "bg-blue-600 text-white",
  },
  new_movie: { label: "New movie", icon: Sparkles, className: "bg-primary text-primary-foreground" },
  now_playing: { label: "Now playing", icon: PlayCircle, className: "bg-emerald-600 text-white" },
  release_date: {
    label: "Date change",
    icon: CalendarClock,
    className: "bg-amber-500 text-white",
  },
  favorite_date: {
    label: "New date",
    icon: CalendarPlus,
    className: "bg-accent text-accent-foreground",
  },
};

// Fallback for any unknown/new activity type so the feed never crashes.
const FALLBACK_META = {
  label: "Update",
  icon: Activity,
  className: "bg-secondary text-foreground",
} as const;

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ShowtimeRow({ session }: { session: ShowSession }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-sm">
      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
        <Clock className="h-3.5 w-3.5 text-primary" />
        {formatTime(session.startDateTime)}
      </span>
      {session.experienceTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {session.experienceTypes.map((t) => (
            <Badge key={t} variant="outline" className={cn("border px-1.5 py-0 text-[10px]", experienceClass(t))}>
              {t}
            </Badge>
          ))}
        </div>
      ) : null}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {session.isSoldOut ? (
          <span className="font-medium text-destructive">Sold out</span>
        ) : typeof session.seatsRemaining === "number" ? (
          <span className="inline-flex items-center gap-1">
            <Armchair className="h-3 w-3" />
            {session.seatsRemaining} seats
          </span>
        ) : null}
      </span>
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const meta = TYPE_META[event.type] ?? FALLBACK_META;
  const Icon = meta.icon;
  const sessions = event.sessions ?? [];
  const hasSessions = sessions.length > 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md bg-secondary">
        {event.posterUrl ? (
          <img src={event.posterUrl} alt={event.filmName} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("gap-1", meta.className)}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{timeAgo(event.detectedAt)}</span>
        </div>
        <p className="mt-1 truncate font-semibold text-foreground" title={event.filmName}>
          {event.filmName}
        </p>
        <p className={cn("text-sm text-muted-foreground", hasSessions ? "" : "truncate")}>{event.detail}</p>

        {hasSessions ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {sessions.map((s) => (
              <ShowtimeRow key={s.sessionId} session={s} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notify", "activity"],
    queryFn: () => notifyApi.getActivity(200),
    refetchInterval: 60_000,
  });

  const scan = useMutation({
    mutationFn: notifyApi.scanNow,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notify", "activity"] });
      toast({
        title: res.newCount > 0 ? `${res.newCount} new update(s)` : "No new updates",
        description:
          res.newCount > 0
            ? "New catalog changes were found."
            : "Everything is already up to date.",
      });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Scan failed", description: (e as Error).message }),
  });

  const events = data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Activity</h3>
            <p className="text-xs text-muted-foreground">
              New movies, advance tickets and date changes as they're detected.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={scan.isPending}
          onClick={() => scan.mutate()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", scan.isPending && "animate-spin")} />
          Scan now
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : events.length === 0 ? (
        <EmptyState message="No updates yet. We'll list new movies, advance tickets and date changes here as they appear." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {events.map((e) => (
            <ActivityRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
