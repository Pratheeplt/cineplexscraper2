import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock, Send, Link2, CheckCircle2, AlertCircle } from "lucide-react";
import { notifyApi, INTERVAL_PRESETS, type NotifySettings as Settings } from "@/lib/notifyApi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function NotifySettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: ["notify", "settings"],
    queryFn: notifyApi.getSettings,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notify", "settings"] });

  const update = useMutation({
    mutationFn: (patch: Partial<Pick<Settings, "enabled" | "intervalMinutes">>) =>
      notifyApi.updateSettings(patch),
    onSuccess: invalidate,
    onError: (e) =>
      toast({ variant: "destructive", title: "Update failed", description: (e as Error).message }),
  });

  const connect = useMutation({
    mutationFn: notifyApi.connectTelegram,
    onSuccess: () => {
      invalidate();
      toast({ title: "Telegram connected", description: "Alerts will be sent to your chat." });
    },
    onError: (e) =>
      toast({ variant: "destructive", title: "Couldn't connect", description: (e as Error).message }),
  });

  const test = useMutation({
    mutationFn: notifyApi.testTelegram,
    onSuccess: () => toast({ title: "Test sent", description: "Check your Telegram." }),
    onError: (e) =>
      toast({ variant: "destructive", title: "Test failed", description: (e as Error).message }),
  });

  const connected = settings?.telegramConnected ?? false;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground">Notification settings</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
          <div>
            <Label htmlFor="notify-enabled" className="text-sm font-medium">
              Auto-checking
            </Label>
            <p className="text-xs text-muted-foreground">Poll Cineplex in the background</p>
          </div>
          <Switch
            id="notify-enabled"
            checked={settings?.enabled ?? false}
            onCheckedChange={(v) => update.mutate({ enabled: v })}
          />
        </div>

        {/* Interval preset */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Check every</Label>
          </div>
          <Select
            value={String(settings?.intervalMinutes ?? 30)}
            onValueChange={(v) => update.mutate({ intervalMinutes: Number(v) })}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_PRESETS.map((p) => (
                <SelectItem key={p.minutes} value={String(p.minutes)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Telegram */}
      <div className="mt-4 rounded-lg border border-border/60 bg-background/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Telegram alerts</p>
              <p
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  connected ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                {connected ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3" /> Not connected
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={connect.isPending}
              onClick={() => connect.mutate()}
            >
              <Link2 className="h-3.5 w-3.5" />
              {connected ? "Reconnect" : "Connect"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!connected || test.isPending}
              onClick={() => test.mutate()}
            >
              <Send className="h-3.5 w-3.5" />
              Test
            </Button>
          </div>
        </div>

        {!connected ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Open{" "}
            <a
              href="https://t.me/cineplexscraperbot"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              t.me/cineplexscraperbot
            </a>
            , send <span className="font-mono text-foreground">/start</span>, then tap Connect.
          </p>
        ) : null}
      </div>
    </div>
  );
}
