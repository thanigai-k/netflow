import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { Fragment, useMemo, useState } from "react";

import { buildSummary, groupByDate } from "@/analytics";
import { PageHero } from "@/components/PageHero";
import { SearchField } from "@/components/SearchField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { matchesFilters } from "@/filters";
import { flowClass, monthLabel, signed, weekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatExact } from "@/money";
import { UNCATEGORISED } from "@/merchant/config";
import type { Transaction } from "@/types";

type Flow = "all" | "debits" | "credits";
type SortKey = "date" | "merchant" | "amount";

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [flow, setFlow] = useState<Flow>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });
  const merchantAnchor = useComboboxAnchor();

  const merchantOptions = useMemo(
    () => [...new Set(transactions.map((t) => t.merchant))].sort(),
    [transactions],
  );

  const summary = useMemo(() => buildSummary(transactions), [transactions]);

  const rows = useMemo(() => {
    const wanted =
      flow === "all" ? null : flow === "debits" ? "DEBIT" : "CREDIT";
    const filtered = transactions.filter(
      (t) =>
        matchesFilters(t, query, picked) &&
        (wanted === null || t.transactionType === wanted),
    );
    const compare = (a: Transaction, b: Transaction) => {
      if (sort.key === "merchant") return a.merchant.localeCompare(b.merchant);
      if (sort.key === "amount") return a.amount - b.amount;
      return a.date.localeCompare(b.date);
    };
    return [...filtered].sort((a, b) =>
      sort.dir === "asc" ? compare(a, b) : compare(b, a),
    );
  }, [transactions, query, picked, flow, sort]);

  // The filtered slice's own net, so the hero number tracks the filters.
  const filteredNet = useMemo(
    () =>
      rows.reduce(
        (sum, t) =>
          sum + (t.transactionType === "DEBIT" ? -t.amount : t.amount),
        0,
      ),
    [rows],
  );

  // Grouping only makes sense while the list is in date order.
  const grouped = sort.key === "date";
  const groups = useMemo(
    () => (grouped ? groupByDate(rows) : []),
    [grouped, rows],
  );

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "merchant" ? "asc" : "desc" },
    );

  return (
    <>
      <PageHero
        title="Transactions"
        subtitle={`${rows.length} of ${transactions.length} rows for ${monthLabel(summary.from)}, ${grouped && sort.dir === "desc" ? "newest first" : "sorted by " + sort.key}`}
        stats={[
          {
            label: "Filtered total",
            value: signed(filteredNet),
            className: flowClass(filteredNet),
          },
        ]}
      />

      <Card className="py-3">
        <CardContent className="flex flex-wrap items-center gap-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Filter by narration or merchant"
            className="flex-1 sm:w-auto sm:min-w-64"
          />
          <Combobox
            items={merchantOptions}
            multiple
            value={picked}
            onValueChange={setPicked}
          >
            <ComboboxChips ref={merchantAnchor} className="w-full sm:w-52">
              <ComboboxValue>
                {picked.map((item) => (
                  <ComboboxChip key={item}>{item}</ComboboxChip>
                ))}
              </ComboboxValue>
              <ComboboxChipsInput
                placeholder={picked.length === 0 ? "Filter by merchant" : ""}
              />
            </ComboboxChips>
            <ComboboxContent anchor={merchantAnchor}>
              <ComboboxEmpty>No merchant found.</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <ToggleGroup
            spacing={0}
            variant="outline"
            size="sm"
            value={[flow]}
            onValueChange={(next) => setFlow((next[0] as Flow) ?? "all")}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="debits">Debits</ToggleGroupItem>
            <ToggleGroupItem value="credits">Credits</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-muted-foreground ms-auto text-sm">
            {rows.length} of {transactions.length} shown
          </span>
        </CardContent>
      </Card>

      <Card className="gap-0 pb-0">
        <CardContent className="px-0">
          {/* The clamp goes on shadcn's own table container: it is the
              nearest scroll parent, so that is what a sticky thead sticks to. */}
          <div className="[&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-y-auto">
            <Table>
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-32">
                    <SortHead
                      sort={sort}
                      onSort={toggleSort}
                      column="date"
                      label="Date"
                    />
                  </TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="w-40">
                    <SortHead
                      sort={sort}
                      onSort={toggleSort}
                      column="merchant"
                      label="Merchant"
                    />
                  </TableHead>
                  <TableHead className="w-36 text-right">
                    <SortHead
                      sort={sort}
                      onSort={toggleSort}
                      column="amount"
                      label="Amount"
                      align="end"
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped
                  ? groups.map((group) => (
                      <Fragment key={group.date}>
                        <TableRow className="bg-transparent hover:bg-transparent">
                          <TableCell colSpan={2} className="pt-6">
                            <span className="font-medium text-lg">
                              {group.date}
                            </span>
                            <span className="text-muted-foreground ms-3 text-sm">
                              {weekday(group.date)} · {group.rows.length}{" "}
                              transaction{group.rows.length === 1 ? "" : "s"}
                            </span>
                          </TableCell>
                          <TableCell
                            colSpan={2}
                            className={cn(
                              "text-muted-foreground pt-6 text-right tabular-nums",
                              group.net > 0 && "text-success",
                            )}
                          >
                            {signed(group.net)}
                          </TableCell>
                        </TableRow>
                        {group.rows.map((t, index) => (
                          <TransactionRow
                            key={`${t.date}-${index}`}
                            transaction={t}
                            indent
                          />
                        ))}
                      </Fragment>
                    ))
                  : rows.map((t, index) => (
                      <TransactionRow key={`${t.date}-${index}`} transaction={t} />
                    ))}
              </TableBody>
            </Table>
          </div>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No transactions match these filters</EmptyTitle>
                <EmptyDescription>
                  Clear the merchant chips or the search box to see everything
                  again.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
        </CardContent>
        {rows.length > 0 ? (
          <CardFooter className="text-muted-foreground justify-center py-4 text-sm">
            Showing all {rows.length} row{rows.length === 1 ? "" : "s"}
            {rows.length > 14 ? " · scroll for more" : ""}
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
}

function SortHead({
  sort,
  onSort,
  column,
  label,
  align = "start",
}: {
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  column: SortKey;
  label: string;
  align?: "start" | "end";
}) {
  const active = sort.key === column;
  const Icon = !active
    ? CaretUpDownIcon
    : sort.dir === "asc"
      ? CaretUpIcon
      : CaretDownIcon;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(column)}
      className={cn(
        "text-muted-foreground -mx-2 font-normal",
        active && "text-foreground",
        align === "end" && "ms-auto",
      )}
    >
      {label}
      <Icon data-icon="inline-end" />
    </Button>
  );
}

function MerchantCell({ merchant }: { merchant: string }) {
  return merchant === UNCATEGORISED ? (
    <Badge variant="secondary">{merchant}</Badge>
  ) : (
    <>{merchant}</>
  );
}

function TransactionRow({
  transaction: t,
  indent = false,
}: {
  transaction: Transaction;
  /** Inside a day group the date lives on the group header, not the row. */
  indent?: boolean;
}) {
  const credit = t.transactionType === "CREDIT";
  return (
    <TableRow>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {indent ? "" : t.date}
      </TableCell>
      <TableCell className="max-w-0 font-mono text-xs">
        <span
          className="block truncate text-muted-foreground"
          title={t.narration}
        >
          {t.narration}
        </span>
      </TableCell>
      <TableCell>
        <MerchantCell merchant={t.merchant} />
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums whitespace-nowrap",
          credit && "text-success",
        )}
      >
        {credit ? "+" : "−"}
        {formatExact(t.amount)}
      </TableCell>
    </TableRow>
  );
}
