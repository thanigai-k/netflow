import { useMemo, useState } from "react";

import { buildSummary, coverage, merchantSummary, type MerchantRow } from "@/analytics";
import type { View } from "@/components/AppSidebar";
import { MerchantDialog } from "@/components/MerchantDialog";
import { PageHero } from "@/components/PageHero";
import { SearchField } from "@/components/SearchField";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { barColor, flowClass, monthLabel, signed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatExact } from "@/money";
import { searchMerchants } from "@/filters";
import type { Transaction } from "@/types";

export function Dashboard({
  transactions,
  onView,
}: {
  transactions: Transaction[];
  onView: (view: View) => void;
}) {
  const summary = useMemo(() => buildSummary(transactions), [transactions]);
  const allMerchants = useMemo(
    () => merchantSummary(transactions, null),
    [transactions],
  );
  const stats = useMemo(() => coverage(transactions), [transactions]);

  const [merchantQuery, setMerchantQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  // searchMerchants already caps an empty query at the top ten.
  const merchantRows = useMemo(
    () => searchMerchants(allMerchants, merchantQuery),
    [allMerchants, merchantQuery],
  );

  const share = (row: MerchantRow) =>
    summary.totalDebit ? (row.spend / summary.totalDebit) * 100 : 0;
  const topThree = allMerchants.slice(0, 3);
  const concentration = topThree.reduce((sum, row) => sum + share(row), 0);

  return (
    <>
      <PageHero
        eyebrow={`Spent in ${monthLabel(summary.from)}`}
        title={formatExact(summary.totalDebit)}
        stats={[
          {
            label: "Credited",
            value: `+${formatExact(summary.totalCredit)}`,
            className: "text-success",
          },
          {
            label: "Net cash flow",
            value: signed(summary.netCashFlow),
            className: flowClass(summary.netCashFlow),
          },
          { label: "Categorised", value: `${Math.round(stats.percent)}%` },
        ]}
      />

      <div className="grid items-start gap-6 @4xl/main:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
            <CardDescription>
              {merchantQuery.trim()
                ? `${merchantRows.length} of ${allMerchants.length} merchants match`
                : "Top 10 merchants by debit — click a bar for its transactions"}
            </CardDescription>
            <CardAction>
              <SearchField
                value={merchantQuery}
                onChange={setMerchantQuery}
                placeholder="Search all merchants"
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col">
            {merchantRows.map((row, index) => (
              <button
                key={row.merchant}
                type="button"
                onClick={() => setSelected(row.merchant)}
                className="hover:bg-accent/40 focus-visible:ring-ring/50 -mx-2 flex items-center gap-4 rounded-md border-b px-2 py-2.5 text-left last:border-b-0 focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <span className="w-32 shrink-0 truncate text-sm">
                  {row.merchant}
                </span>
                <span className="bg-muted h-6 flex-1 overflow-hidden rounded-md">
                  <span
                    className={cn("block h-full rounded-md", barColor(index))}
                    style={{ width: `${Math.max(share(row), 1)}%` }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                  {formatExact(row.spend)}
                </span>
                <span className="text-muted-foreground w-14 shrink-0 text-right text-sm tabular-nums">
                  {share(row).toFixed(1)}%
                </span>
              </button>
            ))}
            {merchantRows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No merchant matches “{merchantQuery}”</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {topThree.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Concentration</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-4xl font-semibold tabular-nums">
                  {concentration.toFixed(1)}%
                </p>
                <p className="text-muted-foreground text-sm">
                  of the month sits in {topThree.length === 1 ? "one" : "three"}{" "}
                  merchant{topThree.length === 1 ? "" : "s"}:{" "}
                  {topThree.map((row) => row.merchant).join(", ")}.
                </p>
                <span className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                  {allMerchants.slice(0, 8).map((row, index) => (
                    <span
                      key={row.merchant}
                      title={`${row.merchant} — ${share(row).toFixed(1)}%`}
                      className={cn("block rounded-sm", barColor(index))}
                      style={{ width: `${Math.max(share(row), 1)}%` }}
                    />
                  ))}
                </span>
              </CardContent>
            </Card>
          ) : null}

          {stats.uncategorised > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Still unlabelled</CardTitle>
                <CardDescription>
                  {stats.uncategorised} of {stats.total} transactions have no
                  matching rule.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-start gap-4">
                <p className="text-4xl font-semibold tabular-nums">
                  {formatExact(stats.uncategorisedSpend)}
                </p>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => onView("uncategorised")}
                >
                  Label these
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {selected ? (
        <MerchantDialog
          merchant={selected}
          transactions={transactions}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
