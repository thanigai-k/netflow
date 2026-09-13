import { CaretDownIcon } from "@phosphor-icons/react";

import type { MonthSummary } from "@/analytics";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { monthKeyLabel } from "@/dates";
import { cn } from "@/lib/utils";
import { formatExact } from "@/money";

/** Shared by the Dashboard and Transactions headers — one month selection for both. */
export function MonthPicker({
  months,
  selected,
  onSelect,
}: {
  months: MonthSummary[];
  /** "all" or a "YYYY-MM" key. */
  selected: string;
  onSelect: (monthKey: string) => void;
}) {
  const label = selected === "all" ? "All months" : monthKeyLabel(selected);
  const totalCount = months.reduce((sum, m) => sum + m.count, 0);
  const totalDebit = months.reduce((sum, m) => sum + m.totalDebit, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="rounded-full">
            <span>{label}</span>
            <CaretDownIcon data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-72">
        {months.length > 0 ? (
          <>
            <MonthPickerItem
              active={selected === "all"}
              label="All months"
              meta={`${totalCount} txns · ${formatExact(totalDebit)}`}
              onClick={() => onSelect("all")}
            />
            <DropdownMenuSeparator />
          </>
        ) : null}
        {months.map((m) => (
          <MonthPickerItem
            key={m.month}
            active={selected === m.month}
            label={monthKeyLabel(m.month)}
            meta={`${m.count} txns · ${formatExact(m.totalDebit)}`}
            onClick={() => onSelect(m.month)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MonthPickerItem({
  active,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-4",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <span>{label}</span>
      <span className="text-muted-foreground text-xs tabular-nums">{meta}</span>
    </DropdownMenuItem>
  );
}
