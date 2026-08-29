import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  useComboboxAnchor,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  buildSummary,
  coverage,
  groupByDate,
  merchantSummary,
  uncategorisedSpending,
  type MerchantRow,
} from "./analytics";
import { AppSidebar, type View } from "./components/AppSidebar";
import { ConfigEditor } from "./components/ConfigEditor";
import { MerchantDialog } from "./components/MerchantDialog";
import { matchesFilters, searchMerchants } from "./filters";
import { enrich } from "./enrich";
import {
  loadConfig,
  UNCATEGORISED,
  type MerchantRule,
} from "./merchant/config";
import { clearOverride, readOverride, writeOverride } from "./merchant/store";
import { formatExact } from "./money";
import { parseStatement, StatementError } from "./parse/statement";
import type { Transaction } from "./types";

export default function App() {
  const [merchants, setMerchants] = useState<MerchantRule[]>([]);
  const [configProblems, setConfigProblems] = useState<string[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  // True when the live rules are this browser's edits, not the shipped file.
  const [edited, setEdited] = useState(false);
  // A narration handed over from the Uncategorised tab to seed a new rule.
  const [prefill, setPrefill] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");

  // Parsed rows, kept so a config reload re-labels without re-reading the file.
  const rawTransactions = useRef<Transaction[] | null>(null);

  const refreshConfig = useCallback(async () => {
    // Browser edits win over the shipped file until they are discarded.
    const override = readOverride();
    if (override) {
      setMerchants(override);
      setConfigProblems([]);
      setConfigError(null);
      setEdited(true);
      setConfigLoaded(true);
      return;
    }
    setEdited(false);
    try {
      const result = await loadConfig();
      setMerchants(result.merchants);
      setConfigProblems(result.problems);
      setConfigError(null);
    } catch (cause) {
      setMerchants([]);
      setConfigProblems([]);
      setConfigError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  const saveMerchants = useCallback((next: MerchantRule[]) => {
    writeOverride(next);
    setMerchants(next);
    setEdited(true);
  }, []);

  const resetMerchants = useCallback(() => {
    clearOverride();
    void refreshConfig();
  }, [refreshConfig]);

  const addRuleFor = useCallback((narration: string) => {
    setPrefill(narration);
    setView("config");
  }, []);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  // Re-label whenever the config changes. The file is never re-read.
  useEffect(() => {
    if (rawTransactions.current) {
      setTransactions(enrich(rawTransactions.current, merchants));
    }
  }, [merchants]);

  const loadFile = useCallback(
    async (file: File) => {
      setFileError(null);
      try {
        const parsed = parseStatement(await file.arrayBuffer());
        rawTransactions.current = parsed;
        setTransactions(enrich(parsed, merchants));
        setFileName(file.name);
        setView("dashboard");
      } catch (cause) {
        rawTransactions.current = null;
        setTransactions(null);
        setFileError(
          cause instanceof StatementError
            ? cause.message
            : `Could not read this file. ${cause instanceof Error ? cause.message : ""}`,
        );
      }
    },
    [merchants],
  );

  const stats = useMemo(
    () => (transactions ? coverage(transactions) : null),
    [transactions],
  );
  const summary = useMemo(
    () => (transactions ? buildSummary(transactions) : null),
    [transactions],
  );

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        view={view}
        onView={setView}
        disabled={!transactions}
        uncategorised={stats?.uncategorised ?? 0}
        fileName={fileName}
        period={
          summary?.from && summary.to ? `${summary.from} → ${summary.to}` : null
        }
        transactionCount={summary?.transactionCount ?? 0}
        ruleCount={merchants.length}
        onReload={() => void refreshConfig()}
        onFile={loadFile}
      />
      <SidebarInset>
        <div className="@container/main flex flex-1 flex-col gap-6 p-6 lg:p-8">
          {fileError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not read that statement</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          ) : null}

          {!transactions ? (
            <>
              <ConfigStatus
                loaded={configLoaded}
                count={merchants.length}
                error={configError}
                problems={configProblems}
                compact
              />
              <Landing ruleCount={merchants.length} onFile={loadFile} />
            </>
          ) : view === "dashboard" ? (
            <Dashboard transactions={transactions} onView={setView} />
          ) : view === "transactions" ? (
            <TransactionTable transactions={transactions} />
          ) : view === "uncategorised" ? (
            <Uncategorised transactions={transactions} onAddRule={addRuleFor} />
          ) : (
            <ConfigHelp
              merchants={merchants}
              status={
                <ConfigStatus
                  loaded={configLoaded}
                  count={merchants.length}
                  error={configError}
                  problems={configProblems}
                  compact
                />
              }
              onSave={saveMerchants}
              onReset={resetMerchants}
              edited={edited}
              prefill={prefill}
              onPrefillConsumed={() => setPrefill(null)}
            />
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function ConfigStatus({
  loaded,
  count,
  error,
  problems,
  compact = false,
}: {
  loaded: boolean;
  count: number;
  error: string | null;
  problems: string[];
  compact?: boolean;
}) {
  if (!loaded) return null;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Config could not be loaded</AlertTitle>
        <AlertDescription>
          {error} Every transaction will stay {UNCATEGORISED}.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {compact ? null : count === 0 ? (
        <Alert>
          <AlertTitle>No merchant rules loaded</AlertTitle>
          <AlertDescription>
            Every transaction is {UNCATEGORISED}. Add rules to{" "}
            <code>public/merchants.json</code> and hit Reload config.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          {count} merchant rule{count === 1 ? "" : "s"} loaded from{" "}
          <code>public/merchants.json</code>.
        </p>
      )}
      {problems.length > 0 ? (
        <Alert>
          <AlertTitle>Config warnings</AlertTitle>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 ps-4">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Landing({
  ruleCount,
  onFile,
}: {
  ruleCount: number;
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          Netflow
        </h2>
        <p className="text-muted-foreground">
          Every merchant comes from your config. Nothing leaves your browser.
        </p>
      </div>

      <Card
        className={cn(
          "border-dashed py-0 transition-colors",
          dragging && "border-primary bg-accent",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <Empty className="min-h-80">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DownloadSimpleIcon />
            </EmptyMedia>
            <EmptyTitle className="text-xl">
              Drop a bank statement to begin
            </EmptyTitle>
            <EmptyDescription>
              Drop an HDFC / ICICI / SBI statement (.xls or .xlsx), or click to
              choose. It is parsed entirely in this browser tab — no server, no
              upload.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <FieldLabel
              htmlFor="statement-file"
              className={cn(
                buttonVariants({ size: "lg" }),
                "cursor-pointer rounded-full",
              )}
            >
              Choose a file
            </FieldLabel>
          </EmptyContent>
        </Empty>
        <input
          id="statement-file"
          type="file"
          accept=".xls,.xlsx"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </Card>

      <div className="grid gap-4 @2xl/main:grid-cols-3">
        <LandingNote
          title={`${ruleCount} merchant rule${ruleCount === 1 ? "" : "s"} loaded`}
        >
          From <code>public/merchants.json</code>. Edit them in Config.
        </LandingNote>
        <LandingNote title="Labelled by your rules only">
          Anything a rule does not match stays {UNCATEGORISED}.
        </LandingNote>
        <LandingNote title="Nothing is stored">
          Close the tab and the statement is gone. Rules stay.
        </LandingNote>
      </div>
    </div>
  );
}

function LandingNote({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground px-4 text-sm">
        {children}
      </CardContent>
    </Card>
  );
}

interface HeroStat {
  label: string;
  value: string;
  className?: string;
}

/**
 * The per-view page header. Replaces the old app-wide top bar, so it also
 * carries the sidebar trigger on small screens where the sidebar is a sheet.
 */
function PageHero({
  eyebrow,
  title,
  subtitle,
  stats,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: HeroStat[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex items-start gap-2">
        <SidebarTrigger className="mt-1 md:hidden" />
        <div className="flex flex-col gap-1">
          {eyebrow ? (
            <p className="text-muted-foreground text-sm">{eyebrow}</p>
          ) : null}
          <h1 className="text-4xl font-semibold tracking-tight tabular-nums">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {stats && stats.length > 0 ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 text-right">
              <dt className="text-muted-foreground text-sm">{stat.label}</dt>
              <dd
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  stat.className,
                )}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** "August 2026" from an ISO date, for the hero lines. */
function monthLabel(date: string | null): string {
  if (!date) return "this statement";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

const signed = (paise: number) =>
  `${paise < 0 ? "\u2212" : "+"}${formatExact(Math.abs(paise))}`;

const flowClass = (paise: number) =>
  paise < 0 ? "text-destructive" : "text-success";

/** Cycles the chart ramp so every bar in a list gets a distinct colour. */
const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];
const barColor = (index: number) => BAR_COLORS[index % BAR_COLORS.length];

function MerchantCell({ merchant }: { merchant: string }) {
  return merchant === UNCATEGORISED ? (
    <Badge variant="secondary">{merchant}</Badge>
  ) : (
    <>{merchant}</>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <InputGroup className={cn("w-full sm:w-72", className)}>
      <InputGroupAddon>
        <MagnifyingGlassIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </InputGroup>
  );
}

function Dashboard({
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

type Flow = "all" | "debits" | "credits";
type SortKey = "date" | "merchant" | "amount";

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
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
        {credit ? "+" : "\u2212"}
        {formatExact(t.amount)}
      </TableCell>
    </TableRow>
  );
}

/** "Sunday" from an ISO date, for the day group headers. */
function weekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
  });
}

function Uncategorised({
  transactions,
  onAddRule,
}: {
  transactions: Transaction[];
  onAddRule: (narration: string) => void;
}) {
  const rows = useMemo(
    () => uncategorisedSpending(transactions, 40),
    [transactions],
  );
  const stats = useMemo(() => coverage(transactions), [transactions]);

  // A paste-ready config block for everything still unlabelled.
  const snippet = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({ name: "CHANGE ME", contains: [row.narration] })),
        null,
        2,
      ),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <>
        <PageHero title="Uncategorised" />
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing left to label</EmptyTitle>
                <EmptyDescription>
                  Every debit is labelled by your config. 🎉
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHero
        title="Uncategorised"
        subtitle={`${rows.length} narration${rows.length === 1 ? "" : "s"} with no matching rule — hit Add rule to seed one.`}
        stats={[
          {
            label: "Unlabelled spend",
            value: formatExact(stats.uncategorisedSpend),
          },
          {
            label: "Transactions",
            value: `${stats.uncategorised} of ${stats.total}`,
          },
        ]}
      />
      <Card>
        <CardContent className="flex flex-col gap-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Txns</TableHead>
                <TableHead className="text-right">Rule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.narration}>
                  <TableCell className="max-w-md font-mono text-xs">
                    <span className="line-clamp-2" title={row.narration}>
                      {row.narration}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatExact(row.spend)}
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAddRule(row.narration)}
                    >
                      Add rule
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Collapsible className="flex flex-col gap-3">
            <CollapsibleTrigger
              render={
                <Button variant="outline" className="self-start">
                  Starter config for these {rows.length} narrations
                </Button>
              }
            />
            <CollapsibleContent>
              <Field>
                <FieldLabel htmlFor="starter-config">
                  Paste-ready rules
                </FieldLabel>
                <Textarea
                  id="starter-config"
                  readOnly
                  rows={12}
                  value={snippet}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                <FieldDescription>
                  Full narrations, so each rule matches exactly one kind of row.
                  Replace each <code>CHANGE ME</code> with a merchant name and
                  shorten <code>contains</code> to the distinctive part.
                </FieldDescription>
              </Field>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </>
  );
}

function ConfigHelp({
  merchants,
  status,
  ...editor
}: { merchants: MerchantRule[]; status: React.ReactNode } & Omit<
  ComponentProps<typeof ConfigEditor>,
  "merchants"
>) {
  return (
    <>
      <PageHero
        title="Config"
        subtitle="Edits live in this browser and re-label the statement immediately; download the JSON to commit them to public/merchants.json."
        stats={[
          {
            label: "Rules",
            value: `${merchants.length}`,
          },
        ]}
      />
      {status}
      <Card>
        <CardContent className="flex flex-col gap-6">
          <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-md p-4 font-mono text-xs">
            {`{
    "merchants": [
      { "name": "Swiggy", "contains": ["SWIGGY"] },
      { "name": "Fruits", "contains": ["FRUITS", "FRUIT CENTRE"] }
    ]
  }`}
          </pre>

          <ul className="text-muted-foreground flex list-disc flex-col gap-2 ps-5 text-sm">
            <li>
              <strong>name</strong> — the label shown in the dashboard.
            </li>
            <li>
              <strong>contains</strong> — strings to look for. A rule matches if{" "}
              <em>any</em> of them appears anywhere in the narration.
            </li>
            <li>
              Matching is a plain case-insensitive substring test on the raw
              narration. No normalisation, no word boundaries, nothing stripped
              — <code>"UPI/"</code> matches literally.
            </li>
            <li>
              <strong>Order matters.</strong> The first matching rule wins, so
              put specific rules above general ones.
            </li>
            <li>
              Anything unmatched stays <strong>{UNCATEGORISED}</strong>.
            </li>
          </ul>

          <Separator />

          <ConfigEditor merchants={merchants} {...editor} />
        </CardContent>
      </Card>
    </>
  );
}
