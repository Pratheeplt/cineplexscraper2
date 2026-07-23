import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, RefreshCw } from "lucide-react";
import { notifyApi } from "@/lib/notifyApi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AddWatchForm } from "./notify/AddWatchForm";
import { NotifySettings } from "./notify/NotifySettings";
import { WatchCard } from "./notify/WatchCard";
import { HistoryList } from "./notify/HistoryList";
import { ListSkeleton, ErrorState, EmptyState } from "./StateViews";

interface NotifyTabProps {
  preselectFilmId?: number | null;
  onPreselectConsumed?: () => void;
}

export function NotifyTab({ preselectFilmId, onPreselectConsumed }: NotifyTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["notify", "watches"],
    queryFn: notifyApi.listWatches,
    refetchInterval: 60_000,
  });

  const watches = data ?? [];

  const checkNow = useMutation({
    mutationFn: notifyApi.checkNow,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notify", "watches"] });
      queryClient.invalidateQueries({ queryKey: ["notify", "history"] });
      toast({
        title: res.newCount > 0 ? `${res.newCount} new showtime(s)!` : "All caught up",
        description:
          res.newCount > 0 ? "Telegram alerts were sent." : "No new showtimes right now.",
      });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Check failed", description: (e as Error).message }),
  });

  return (
    <div className="space-y-5">
      <AddWatchForm
        preselectFilmId={preselectFilmId}
        onPreselectConsumed={onPreselectConsumed}
      />

      <NotifySettings />

      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Bell className="h-4 w-4 text-primary" />
          <span>
            <span className="font-semibold text-foreground">{watches.length}</span>{" "}
            {watches.length === 1 ? "film watched" : "films watched"}
          </span>
        </p>
        {watches.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={checkNow.isPending}
            onClick={() => checkNow.mutate()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", checkNow.isPending && "animate-spin")} />
            Check all now
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : watches.length === 0 ? (
        <EmptyState message="No films tracked yet. Add one above to start getting Telegram alerts." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {watches.map((w) => (
            <WatchCard key={w.id} watch={w} />
          ))}
        </div>
      )}

      <HistoryList />
    </div>
  );
}
