import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTransactionStore } from "@/hooks/use-transaction-store";
import { cn } from "@/lib/utils";
import { buildSummary, coverage, uncategorisedSpending } from "./analytics";
import { AppSidebar, type View } from "./components/AppSidebar";
import { ConfigEditor } from "./components/ConfigEditor";
import { Dashboard } from "./components/Dashboard";
import { PageHero } from "./components/PageHero";
import { TransactionTable } from "./components/TransactionTable";
import {
  loadConfig,
  UNCATEGORISED,
  type MerchantRule,
} from "./merchant/config";
import { clearOverride, readOverride, writeOverride } from "./merchant/store";
import { formatExact } from "./money";
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

  const [view, setView] = useState<View>("dashboard");
  const store = useTransactionStore(merchants);

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

  const loadFile = useCallback(
    async (file: File) => {
      const ok = await store.loadFile(file);
      if (ok) setView("dashboard");
    },
    [store],
  );

  // Sidebar's uncategorised badge and file-range summary cover all loaded
  // data, not just the selected month — it's a worklist, not a period report.
  const allStats = coverage(store.allTransactions);
  const allSummary = buildSummary(store.allTransactions);
  const latestStatement = store.statements.at(-1) ?? null;

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
        disabled={!store.hasData}
        uncategorised={allStats.uncategorised}
        fileName={latestStatement?.fileName ?? null}
        period={
          allSummary.from && allSummary.to
            ? `${allSummary.from} → ${allSummary.to}`
            : null
        }
        transactionCount={allSummary.transactionCount}
        ruleCount={merchants.length}
        onReload={() => void refreshConfig()}
        onFile={loadFile}
      />
      <SidebarInset>
        <div className="@container/main flex flex-1 flex-col gap-6 p-6 lg:p-8">
          {store.fileError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not read that statement</AlertTitle>
              <AlertDescription>{store.fileError}</AlertDescription>
            </Alert>
          ) : null}

          {!store.hasData ? (
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
            <Dashboard
              transactions={store.transactions}
              months={store.months}
              selectedMonth={store.selectedMonth}
              onSelectMonth={store.setSelectedMonth}
              onView={setView}
            />
          ) : view === "transactions" ? (
            <TransactionTable
              transactions={store.transactions}
              months={store.months}
              selectedMonth={store.selectedMonth}
              onSelectMonth={store.setSelectedMonth}
            />
          ) : view === "uncategorised" ? (
            <Uncategorised
              transactions={store.allTransactions}
              onAddRule={addRuleFor}
            />
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
