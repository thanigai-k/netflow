import type { MerchantRow } from "./analytics";
import type { Transaction } from "./types";

/**
 * Merchants whose name contains the query. An empty query means "no search",
 * so it falls back to the leaderboard's top ten.
 */
export function searchMerchants(all: MerchantRow[], query: string, top = 10): MerchantRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return all.slice(0, top);
  return all.filter((row) => row.merchant.toLowerCase().includes(needle));
}

/** Free-text search AND the merchant multi-select, both optional. */
export function matchesFilters(t: Transaction, query: string, picked: string[]): boolean {
  if (picked.length > 0 && !picked.includes(t.merchant)) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    t.narration.toLowerCase().includes(needle) || t.merchant.toLowerCase().includes(needle)
  );
}

/**
 * Debit rows for one merchant, newest first. Debits only, because
 * `merchantSummary` totals debits only — mixing credits in here would make the
 * drill-down disagree with the row that opened it.
 */
export function merchantDebits(transactions: Transaction[], merchant: string): Transaction[] {
  return transactions
    .filter((t) => t.merchant === merchant && t.transactionType === "DEBIT")
    .sort((a, b) => b.date.localeCompare(a.date));
}
