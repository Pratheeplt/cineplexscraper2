import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Calendar,
  Clock,
  Trash2,
  RefreshCw,
  ChevronDown,
  Film,
  Ticket,
  Armchair,
} from "lucide-react";
import type { Watch } from "@/lib/notifyApi";
import { notifyApi } from "@/lib/notifyApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatDateShort,
  formatTime,
  experienceClass,
  distinctFormats,
} from "./format";

export function WatchCard({ watch }: { watch: Watch }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => notifyApi.deleteWatch(watch.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notify", "watches"] });
      toast({ title: "Stopped watching", description: `${watch.filmName} was removed.` });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Couldn't delete", description: (e as Error).message }),
  });

  const check = useMutation({
    mutationFn: () => notifyApi.checkWatch(watch.id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notify", "watches"] });
      queryClient.invalidateQueries({ queryKey: ["notify", "history"] });
      toast({
        title: res.newCount > 0 ? `${res.newCount} new showtime(s)!` : "No new showtimes",
        description:
          res.newCount > 0
            ? "A Telegram alert was sent."
            : "You're up to date for this date.",
      });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Check failed", description: (e as Error).message }),
  });

  const formats = distinctFormats(watch.sessions);
  const dateIsBookable = watch.bookableDates.includes(watch.date);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 p-4">
        {/* Poster */}
        <div className="hidden h-24 w-16 shrink-0 overflow-hidden rounded-md bg-secondary sm:block">
          {watch.posterUrl ? (
            <img src={watch.posterUrl} alt={watch.filmName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="h-6 w-6 text-primary/50" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg leading-tight text-foreground">{watch.filmName}</h3>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stop watching this film?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll no longer be notified about new showtimes for{" "}
                    <span className="font-medium text-foreground">{watch.filmName}</span> at{" "}
                    {watch.theatreName} on {formatDate(watch.date)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep watching</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => remove.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <p className="inline-flex items-center gap-1.5 text-sm text-accent">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{watch.theatreName}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="gap-1 bg-primary text-primary-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(watch.date)}
            </Badge>
            {formats.map((f) => (
              <Badge key={f} variant="outline" className={cn("border", experienceClass(f))}>
                {f}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Latest bookable dates */}
      <div className="border-t border-border/60 px-4 py-3">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Latest bookable dates
        </p>
        {watch.bookableDates.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {watch.bookableDates.map((d) => (
              <span
                key={d}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs",
                  d === watch.date
                    ? "border-primary/50 bg-primary/10 font-semibold text-primary"
                    : "border-border/70 text-muted-foreground"
                )}
              >
                {formatDateShort(d)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No dates open yet — you'll be alerted the moment one appears.
          </p>
        )}
      </div>

      {/* Showtimes for the watched date */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-sm">
              <Ticket className="h-4 w-4 text-primary" />
              {watch.sessions.length > 0
                ? `${watch.sessions.length} showtime${watch.sessions.length === 1 ? "" : "s"} on ${formatDateShort(watch.date)}`
                : `No showtimes yet on ${formatDateShort(watch.date)}`}
              {watch.sessions.length > 0 ? (
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                />
              ) : null}
            </Button>
          </CollapsibleTrigger>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={check.isPending}
            onClick={() => check.mutate()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", check.isPending && "animate-spin")} />
            Check now
          </Button>
        </div>

        <CollapsibleContent>
          <div className="space-y-1.5 px-4 pb-4">
            {watch.sessions.map((s) => (
              <div
                key={s.sessionId}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm"
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {formatTime(s.startDateTime)}
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {s.experienceTypes.map((t) => (
                    <Badge key={t} variant="outline" className={cn("border text-[10px]", experienceClass(t))}>
                      {t}
                    </Badge>
                  ))}
                </div>
                <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  {s.auditorium ? (
                    <span className="inline-flex items-center gap-1">
                      <Armchair className="h-3 w-3" />
                      {s.auditorium}
                    </span>
                  ) : null}
                  {s.isSoldOut ? (
                    <span className="text-destructive">Sold out</span>
                  ) : typeof s.seatsRemaining === "number" ? (
                    <span>{s.seatsRemaining} seats</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {!dateIsBookable && watch.lastCheckedAt ? (
        <div className="border-t border-border/60 bg-primary/5 px-4 py-2 text-xs text-primary">
          Watching for {formatDate(watch.date)} to open for booking…
        </div>
      ) : null}
    </div>
  );
}
