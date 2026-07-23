import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Clock,
  Send,
  Link2,
  CheckCircle2,
  AlertCircle,
  Ticket,
  RefreshCw,
  CalendarPlus,
} from "lucide-react";
import { notifyApi, INTERVAL_PRESETS, type NotifySettingsPatch } from "@/lib/notifyApi";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
    mutationFn: (patch: NotifySettingsPatch) => notifyApi.updateSettings(patch),
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

  // Local form state for the manual Telegram credentials. The token field
  // always starts empty (we never receive the raw token back); the chat id is
  // pre-filled from the saved value.
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState(settings?.telegramChatId ?? "");
  // Keep the chat id input in sync if settings load after first render.
  const savedChatId = settings?.telegramChatId ?? "";
  const [lastSavedChatId, setLastSavedChatId] = useState(savedChatId);
  if (savedChatId !== lastSavedChatId) {
    setLastSavedChatId(savedChatId);
    setChatId(savedChatId);
  }

  const handleSaveTelegram = () => {
    // Send both fields in ONE PATCH to dodge the dev-mode reload race.
    const patch: NotifySettingsPatch = { telegramChatId: chatId.trim() };
    const token = botToken.trim();
    // Only include the token when the user typed one — an empty field must NOT
    // overwrite the already-saved token.
    if (token.length > 0) patch.telegramBotToken = token;

    update.mutate(patch, {
      onSuccess: () => {
        setBotToken("");
        toast({ title: "Telegram settings saved" });
      },
    });
  };

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

      {/* Advance tickets alert */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-blue-500" />
          <div>
            <Label htmlFor="notify-advance" className="text-sm font-medium">
              Advance ticket alerts
            </Label>
            <p className="text-xs text-muted-foreground">
              Get a Telegram message when advance tickets are released
            </p>
          </div>
        </div>
        <Switch
          id="notify-advance"
          checked={settings?.notifyAdvanceTickets ?? false}
          onCheckedChange={(v) => update.mutate({ notifyAdvanceTickets: v })}
        />
      </div>

      {/* New dates for favorite movies alert */}
      <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4 text-accent" />
          <div>
            <Label htmlFor="notify-favorite-dates" className="text-sm font-medium">
              New date alerts for favourite movies
            </Label>
            <p className="text-xs text-muted-foreground">
              Get a Telegram message when new booking dates open for a movie you've favourited (at
              your favourite theatres).
            </p>
          </div>
        </div>
        <Switch
          id="notify-favorite-dates"
          checked={settings?.notifyFavoriteDates ?? false}
          onCheckedChange={(v) => update.mutate({ notifyFavoriteDates: v })}
        />
      </div>

      {/* Catalog data refresh */}
      <div className="mt-4 rounded-lg border border-border/60 bg-background/50 p-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Data refresh</h4>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          How often we re-scan Cineplex for new movies, advance tickets and date changes (shown in
          the Activity tab).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <Label htmlFor="catalog-enabled" className="text-sm font-medium">
              Auto-refresh
            </Label>
            <Switch
              id="catalog-enabled"
              checked={settings?.catalogEnabled ?? false}
              onCheckedChange={(v) => update.mutate({ catalogEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Refresh every</Label>
            </div>
            <Select
              value={String(settings?.catalogIntervalMinutes ?? 60)}
              onValueChange={(v) => update.mutate({ catalogIntervalMinutes: Number(v) })}
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

        {/* Manual credentials */}
        <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tg-bot-token" className="text-xs font-medium text-muted-foreground">
                Bot token
              </Label>
              <Input
                id="tg-bot-token"
                type="password"
                autoComplete="off"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={
                  settings?.hasBotToken
                    ? "•••••••• (a token is already saved)"
                    : "Paste your Telegram bot token"
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tg-chat-id" className="text-xs font-medium text-muted-foreground">
                Chat ID
              </Label>
              <Input
                id="tg-chat-id"
                type="text"
                autoComplete="off"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Paste a bot token &amp; chat ID manually, or send{" "}
              <span className="font-mono text-foreground">/start</span> to the bot and tap Connect to
              auto-detect your chat ID.
            </p>
            <Button
              size="sm"
              className="shrink-0"
              disabled={update.isPending}
              onClick={handleSaveTelegram}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
