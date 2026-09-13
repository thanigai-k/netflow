import type { LiveTransaction } from "@/transactions/live";
import type { PersistedTransactionState } from "@/transactions/store";
import type { Paise } from "@/money";

const TRANSACTIONS_KEY = "netflow.transactions";
const MERCHANTS_KEY = "netflow.merchants";

const keyBytes = (key: string): number => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return 0;
  }
  return raw ? new Blob([raw]).size : 0;
};

/** Total bytes this app holds in localStorage, across both its keys. */
export function totalStorageBytes(): number {
  return keyBytes(TRANSACTIONS_KEY) + keyBytes(MERCHANTS_KEY);
}

export interface MonthStorageRow {
  /** "2026-08" */
  month: string;
  rowCount: number;
  totalDebit: Paise;
  bytes: number;
  /** Distinct statement filenames contributing rows to this month; empty means manual-only. */
  sources: string[];
}

/** One entry per calendar month present in the live data, newest first. */
export function monthStorageRows(
  persisted: PersistedTransactionState,
  allTransactions: LiveTransaction[],
): MonthStorageRow[] {
  const statementIdOf = (rowId: string) => rowId.split(":")[0];
  const fileNameByStatementId = new Map(persisted.statements.map((s) => [s.id, s.fileName]));

  const byMonth = new Map<
    string,
    { rowCount: number; totalDebit: Paise; sources: Set<string>; rows: LiveTransaction[] }
  >();
  for (const row of allTransactions) {
    const month = row.date.slice(0, 7);
    const entry = byMonth.get(month) ?? {
      rowCount: 0,
      totalDebit: 0,
      sources: new Set<string>(),
      rows: [],
    };
    entry.rowCount += 1;
    if (row.transactionType === "DEBIT") entry.totalDebit += row.amount;
    entry.rows.push(row);
    if (!row.manual) {
      const fileName = fileNameByStatementId.get(statementIdOf(row.id));
      if (fileName) entry.sources.add(fileName);
    }
    byMonth.set(month, entry);
  }

  return [...byMonth]
    .map(([month, entry]) => ({
      month,
      rowCount: entry.rowCount,
      totalDebit: entry.totalDebit,
      bytes: new Blob([JSON.stringify(entry.rows)]).size,
      sources: [...entry.sources],
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
