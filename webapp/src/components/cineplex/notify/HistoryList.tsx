import { useQuery } from "@tanstack/react-query";
import { History, Sparkles } from "lucide-react";
import { notifyApi } from "@/lib/notifyApi";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { experienceClass, formatDateShort, formatTime, formatDateTime } from "./format";

export function HistoryList() {
  const { data } = useQuery({
    queryKey: ["notify", "history"],
    queryFn: () => notifyApi.getHistory(50),
    refetchInterval: 60_000,
  });

  const history = data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <History className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Detected showtimes history</h3>
      </div>

      {history.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Newly detected showtimes will show up here — and get sent to your Telegram.
        </p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{h.filmName}</p>
                <p className="truncate text-xs text-muted-foreground">{h.theatreName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold text-foreground">
                    {formatDateShort(h.date)} · {formatTime(h.startDateTime)}
                  </span>
                  {h.experienceTypes.map((t) => (
                    <Badge key={t} variant="outline" className={cn("border text-[10px]", experienceClass(t))}>
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDateTime(h.detectedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
