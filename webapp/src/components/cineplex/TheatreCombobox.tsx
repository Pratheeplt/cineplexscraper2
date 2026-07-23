import { useState } from "react";
import { Check, ChevronsUpDown, MapPin, Star } from "lucide-react";
import type { Theatre } from "../../../../backend/src/types";
import { cn } from "@/lib/utils";
import { useFavoriteTheatres } from "@/hooks/use-favorite-theatres";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const ALL_THEATRES = "all";

type Props = {
  theatres: Theatre[];
  value: string; // theatreId as string, or ALL_THEATRES
  onChange: (value: string) => void;
};

// Typeable theatre picker: search by name and select one to filter movies.
// Favorited theatres are surfaced in a "Favorites" group at the top.
export function TheatreCombobox({ theatres, value, onChange }: Props) {
  const [open, setOpen] = useState<boolean>(false);
  const { isFavorite } = useFavoriteTheatres();

  const selected = theatres.find((t) => String(t.theatreId) === value);
  const label = selected ? selected.theatreName : "All theatres";

  const favorites = theatres.filter((t) => isFavorite(t.theatreId));
  const others = theatres.filter((t) => !isFavorite(t.theatreId));

  const select = (theatreId: number) => {
    onChange(String(theatreId));
    setOpen(false);
  };

  const renderItem = (t: Theatre, favorited: boolean) => (
    <CommandItem
      key={t.theatreId}
      // Command filters on this string, so include the name to make it searchable.
      value={`${t.theatreName} ${t.city ?? ""}`}
      onSelect={() => select(t.theatreId)}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4 shrink-0",
          value === String(t.theatreId) ? "opacity-100" : "opacity-0"
        )}
      />
      <span className="flex min-w-0 items-center gap-1.5">
        {favorited ? (
          <Star className="h-3 w-3 shrink-0 fill-primary text-primary" />
        ) : null}
        <span className="truncate">
          {t.theatreName}
          {t.city ? <span className="text-muted-foreground"> · {t.city}</span> : null}
        </span>
      </span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between gap-2 sm:w-[300px]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type a theatre name…" />
          <CommandList>
            <CommandEmpty>No theatre found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="All theatres"
                onSelect={() => {
                  onChange(ALL_THEATRES);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === ALL_THEATRES ? "opacity-100" : "opacity-0"
                  )}
                />
                All theatres
              </CommandItem>
            </CommandGroup>

            {favorites.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Favorites">
                  {favorites.map((t) => renderItem(t, true))}
                </CommandGroup>
              </>
            ) : null}

            <CommandSeparator />
            <CommandGroup heading={favorites.length > 0 ? "All theatres" : undefined}>
              {others.map((t) => renderItem(t, false))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
