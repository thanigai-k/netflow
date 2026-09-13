import type { Paise } from "./money";
import { UNCATEGORISED, type Transaction } from "./types";

const isDebit = (t: Transaction) => t.transactionType === "DEBIT";

export interface Summary {
  totalDebit: Paise;
  totalCredit: Paise;
  netCashFlow: Paise;
  transactionCount: number;
  monthCount: number;
  averageMonthlySpend: Paise;
  savingsRate: number;
  from: string | null;
  to: string | null;
}

export function buildSummary(transactions: Transaction[]): Summary {
  let totalDebit = 0;
  let totalCredit = 0;
  const months = new Set<string>();

  for (const t of transactions) {
    if (isDebit(t)) totalDebit += t.amount;
    else totalCredit += t.amount;
    months.add(t.date.slice(0, 7));
  }

  const dates = transactions.map((t) => t.date).sort();
  const monthCount = months.size;

  return {
    totalDebit,
    totalCredit,
    netCashFlow: totalCredit - totalDebit,
    transactionCount: transactions.length,
    monthCount,
    averageMonthlySpend: monthCount ? Math.round(totalDebit / monthCount) : 0,
    savingsRate: totalCredit ? ((totalCredit - totalDebit) / totalCredit) * 100 : 0,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  };
}

export interface MerchantRow {
  merchant: string;
  spend: Paise;
  transactions: number;
  average: Paise;
}

/** Debit spend per merchant, biggest first. Uncategorised is just another row. */
export function merchantSummary(
  transactions: Transaction[],
  limit: number | null = 10,
): MerchantRow[] {
  const totals = new Map<string, { spend: Paise; count: number }>();

  for (const t of transactions) {
    if (!isDebit(t)) continue;
    const entry = totals.get(t.merchant) ?? { spend: 0, count: 0 };
    entry.spend += t.amount;
    entry.count += 1;
    totals.set(t.merchant, entry);
  }

  const rows: MerchantRow[] = [...totals].map(([merchant, { spend, count }]) => ({
    merchant,
    spend,
    transactions: count,
    average: Math.round(spend / count),
  }));

  rows.sort((a, b) => b.spend - a.spend);
  return limit === null ? rows : rows.slice(0, limit);
}

/** Debit spend per calendar month, oldest first. */
export function monthlySpend(transactions: Transaction[]): { month: string; spend: Paise }[] {
  const totals = new Map<string, Paise>();
  for (const t of transactions) {
    if (!isDebit(t)) continue;
    const month = t.date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + t.amount);
  }
  return [...totals]
    .map(([month, spend]) => ({ month, spend }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** How much of the statement the config actually covers. */
export function coverage(transactions: Transaction[]) {
  let categorised = 0;
  let uncategorised = 0;
  let categorisedSpend = 0;
  let uncategorisedSpend = 0;

  for (const t of transactions) {
    const uncat = t.merchant === UNCATEGORISED;
    if (uncat) uncategorised += 1;
    else categorised += 1;
    if (!isDebit(t)) continue;
    if (uncat) uncategorisedSpend += t.amount;
    else categorisedSpend += t.amount;
  }

  const total = categorised + uncategorised;
  return {
    categorised,
    uncategorised,
    total,
    categorisedSpend,
    uncategorisedSpend,
    percent: total ? (categorised / total) * 100 : 0,
  };
}

/**
 * Uncategorised debits grouped by exact narration, biggest spend first —
 * the worklist for deciding what to add to the config next.
 */
export function uncategorisedSpending(transactions: Transaction[], limit = 30) {
  const totals = new Map<string, { spend: Paise; count: number }>();

  for (const t of transactions) {
    if (!isDebit(t) || t.merchant !== UNCATEGORISED) continue;
    const entry = totals.get(t.narration) ?? { spend: 0, count: 0 };
    entry.spend += t.amount;
    entry.count += 1;
    totals.set(t.narration, entry);
  }

  return [...totals]
    .map(([narration, { spend, count }]) => ({ narration, spend, count }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit);
}

/** Debit and credit per calendar day, oldest first — the area chart's series. */
export function dailyFlow(
  transactions: Transaction[],
): { date: string; debit: number; credit: number }[] {
  const totals = new Map<string, { debit: Paise; credit: Paise }>();
  for (const t of transactions) {
    const entry = totals.get(t.date) ?? { debit: 0, credit: 0 };
    if (isDebit(t)) entry.debit += t.amount;
    else entry.credit += t.amount;
    totals.set(t.date, entry);
  }
  return [...totals]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthSummary {
  /** "2026-08" */
  month: string;
  count: number;
  totalDebit: Paise;
}

/** One entry per calendar month present in the data, newest first. */
export function monthSummaries(transactions: Transaction[]): MonthSummary[] {
  const totals = new Map<string, { count: number; totalDebit: Paise }>();
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const entry = totals.get(month) ?? { count: 0, totalDebit: 0 };
    entry.count += 1;
    if (isDebit(t)) entry.totalDebit += t.amount;
    totals.set(month, entry);
  }
  return [...totals]
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** Transactions for one calendar month, or everything when `monthKey` is "all". */
export function filterByMonth<T extends Transaction>(
  transactions: T[],
  monthKey: string | "all",
): T[] {
  if (monthKey === "all") return transactions;
  return transactions.filter((t) => t.date.slice(0, 7) === monthKey);
}

export interface DayGroup<T extends Transaction = Transaction> {
  date: string;
  rows: T[];
  /** Credits minus debits for the day. */
  net: Paise;
}

/**
 * Folds a date-sorted list into one group per calendar day. Only consecutive
 * equal dates are folded, so the caller's sort order is preserved as-is.
 */
export function groupByDate<T extends Transaction>(rows: T[]): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const t of rows) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== t.date) {
      group = { date: t.date, rows: [], net: 0 };
      groups.push(group);
    }
    group.rows.push(t);
    group.net += isDebit(t) ? -t.amount : t.amount;
  }
  return groups;
}
