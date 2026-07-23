import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Search, ExternalLink } from "lucide-react";
import type { Theatre } from "../../../../backend/src/types";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { ListSkeleton, ErrorState, EmptyState } from "./StateViews";

function fetchTheatres(): Promise<Theatre[]> {
  return api.get<Theatre[]>("/api/cineplex/theatres");
}

function TheatreCard({ theatre }: { theatre: Theatre }) {
  const location = [theatre.city, theatre.provinceCode].filter(Boolean).join(", ");

  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug text-foreground">{theatre.theatreName}</h3>
        <div className="rounded-md bg-primary/10 p-1.5">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
      </div>

      {location ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-accent">
          <MapPin className="h-3.5 w-3.5" />
          {location}
        </p>
      ) : null}

      {theatre.address ? (
        <p className="text-sm text-muted-foreground">
          {theatre.address}
          {theatre.postalCode ? ` · ${theatre.postalCode}` : ""}
        </p>
      ) : null}

      {theatre.theatreUrl ? (
        <a
          href={theatre.theatreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View on Cineplex
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

export function TheatresTab() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["cineplex", "theatres"],
    queryFn: fetchTheatres,
  });

  const theatres = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return theatres;
    return theatres.filter((t) =>
      [t.theatreName, t.city, t.provinceCode, t.address]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [theatres, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, city or address…"
            className="pl-9"
          />
        </div>

        <p className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          {isLoading ? (
            "Loading…"
          ) : (
            <span>
              <span className="font-semibold text-foreground">{filtered.length}</span>
              {search ? ` of ${theatres.length}` : ""}{" "}
              {filtered.length === 1 ? "theatre" : "theatres"}
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search ? "No theatres match your search." : "No theatres available."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((theatre) => (
            <TheatreCard key={theatre.theatreId} theatre={theatre} />
          ))}
        </div>
      )}
    </div>
  );
}
