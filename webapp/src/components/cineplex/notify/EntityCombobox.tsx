import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

export interface ComboOption {
  id: number;
  label: string;
  sublabel?: string;
}

interface EntityComboboxProps {
  options: ComboOption[];
  value: number | null;
  onSelect: (option: ComboOption | null) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  loading?: boolean;
  disabled?: boolean;
}

export function EntityCombobox({
  options,
  value,
  onSelect,
  placeholder,
  searchPlaceholder,
  emptyText,
  loading,
  disabled,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || loading}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {loading ? "Loading…" : selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.sublabel ?? ""}`}
                  onSelect={() => {
                    onSelect(option.id === value ? null : option);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      option.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate">{option.label}</span>
                    {option.sublabel ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.sublabel}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
