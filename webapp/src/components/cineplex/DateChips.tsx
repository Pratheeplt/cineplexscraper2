import { cn } from "@/lib/utils";
import { weekdayLabel, monthDayLabel } from "./showtime-utils";

type Props = {
  dates: string[];
  selected: string | null;
  onSelect: (date: string) => void;
};

// Horizontal, scrollable row of clickable date buttons for the detail modal.
export function DateChips({ dates, selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {dates.map((date) => {
        const active = date === selected;
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect(date)}
            className={cn(
              "flex min-w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-3 py-2 text-center transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.6)]"
                : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-primary/5"
            )}
          >
            <span className={cn("text-[11px] font-medium uppercase tracking-wide", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {weekdayLabel(date)}
            </span>
            <span className="text-sm font-semibold leading-tight">{monthDayLabel(date)}</span>
          </button>
        );
      })}
    </div>
  );
}
