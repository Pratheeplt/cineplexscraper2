import { useState } from "react";
import { Check, ChevronsUpDown, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  genres: string[]; // all available genres
  selected: string[];
  onChange: (next: string[]) => void;
};

// Searchable multi-select genre picker. A movie matches if it has ANY selected genre.
export function GenreFilter({ genres, selected, onChange }: Props) {
  const [open, setOpen] = useState<boolean>(false);

  const toggle = (genre: string) => {
    onChange(
      selected.includes(genre) ? selected.filter((g) => g !== genre) : [...selected, genre]
    );
  };

  const label =
    selected.length === 0
      ? "All genres"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} genres`;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between gap-2 sm:w-[220px]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Tag className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{label}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search genres…" />
            <CommandList>
              <CommandEmpty>No genre found.</CommandEmpty>
              <CommandGroup>
                {genres.map((genre) => {
                  const active = selected.includes(genre);
                  return (
                    <CommandItem key={genre} value={genre} onSelect={() => toggle(genre)}>
                      <Check
                        className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")}
                      />
                      {genre}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([])}
          className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}

// Small chips row showing the active genres (with quick removal).
export function GenreChips({ selected, onRemove }: { selected: string[]; onRemove: (g: string) => void }) {
  if (selected.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {selected.map((g) => (
        <Badge
          key={g}
          variant="secondary"
          className="cursor-pointer gap-1 hover:bg-secondary/70"
          onClick={() => onRemove(g)}
        >
          {g}
          <X className="h-3 w-3" />
        </Badge>
      ))}
    </div>
  );
}
