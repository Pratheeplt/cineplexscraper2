import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import type { Theatre } from "../../../../backend/src/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const ALL_THEATRES = "all";

type Props = {
  theatres: Theatre[];
  value: string; // theatreId as string, or ALL_THEATRES
  onChange: (value: string) => void;
};

// Typeable theatre picker: search by name and select one to filter movies.
export function TheatreCombobox({ theatres, value, onChange }: Props) {
  const [open, setOpen] = useState<boolean>(false);

  const selected = theatres.find((t) => String(t.theatreId) === value);
  const label = selected ? selected.theatreName : "All theatres";

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
              {theatres.map((t) => (
                <CommandItem
                  key={t.theatreId}
                  // Command filters on this string, so include the name to make it searchable.
                  value={`${t.theatreName} ${t.city ?? ""}`}
                  onSelect={() => {
                    onChange(String(t.theatreId));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(t.theatreId) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">
                    {t.theatreName}
                    {t.city ? (
                      <span className="text-muted-foreground"> · {t.city}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
