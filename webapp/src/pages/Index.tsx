import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MoviesTab } from "@/components/cineplex/MoviesTab";
import { TheatresTab } from "@/components/cineplex/TheatresTab";
import { NotifyTab } from "@/components/cineplex/NotifyTab";
import { ActivityTab } from "@/components/cineplex/ActivityTab";
import { cn } from "@/lib/utils";

const Index = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam === "notify" || tabParam === "theatres" || tabParam === "activity"
      ? tabParam
      : "movies";
  const preselectFilmId = searchParams.get("filmId")
    ? Number(searchParams.get("filmId"))
    : null;

  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "movies") next.delete("tab");
    else next.set("tab", value);
    if (value !== "notify") next.delete("filmId");
    setSearchParams(next, { replace: true });
  };

  const clearPreselect = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("filmId");
    setSearchParams(next, { replace: true });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ["cineplex"] });
      toast({ title: "Refreshed", description: "Latest data loaded from cineplex.com." });
    } catch {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: "Could not reach the server. Please try again.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.7)]">
                <Clapperboard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display text-3xl leading-none text-foreground sm:text-4xl">
                  Cineplex <span className="text-primary">Scraper</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live data from cineplex.com — no login required
                </p>
              </div>
            </div>

            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="w-full border-primary/40 hover:bg-primary/10 sm:w-auto"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="movies">Movies</TabsTrigger>
              <TabsTrigger value="theatres">Theatres</TabsTrigger>
              <TabsTrigger value="notify">Notify</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="movies" className="mt-0">
              <MoviesTab />
            </TabsContent>

            <TabsContent value="theatres" className="mt-0">
              <TheatresTab />
            </TabsContent>

            <TabsContent value="notify" className="mt-0">
              <NotifyTab
                preselectFilmId={preselectFilmId}
                onPreselectConsumed={clearPreselect}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <ActivityTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Index;
