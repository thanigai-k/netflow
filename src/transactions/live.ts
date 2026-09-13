import { enrich } from "@/enrich";
import type { MerchantRule } from "@/merchant/config";
import { parseAmount } from "@/money";
import type { Transaction, TransactionType } from "@/types";

/** A live transaction, tagged with where it came from. */
export type LiveTransaction = Transaction & {
  manual: boolean;
  edited: boolean;
  /** Excluded from spend totals/counts but still shown in the transaction list. */
  ignored: boolean;
};

/** Values from the add/edit modal, before they become a patch. */
export interface TransactionFormValues {
  type: "debit" | "credit";
  /** Raw rupee input, e.g. "1234.50". */
  amount: string;
  date: string;
  narration: string;
  /** Merchant name chosen in the Category field. */
  category: string;
}

const dedupeKey = (t: Transaction) => `${t.date}|${t.narration}|${t.amount}`;

/** Rows from `incoming` that don't already match something in `existing`, by (date, narration, amount). */
export function dedupeAgainst(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const seen = new Set(existing.map(dedupeKey));
  const kept: Transaction[] = [];
  for (const row of incoming) {
    const key = dedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(row);
  }
  return kept;
}

/** Turns modal form values into the fields a manual row or an edit patch shares. */
export function buildPatch(form: TransactionFormValues): Omit<Transaction, "id"> {
  const transactionType: TransactionType = form.type === "debit" ? "DEBIT" : "CREDIT";
  return {
    date: form.date,
    narration: form.narration.trim() || "Manual entry",
    merchant: form.category,
    amount: Math.abs(parseAmount(form.amount) ?? 0),
    transactionType,
    balance: null,
    referenceNumber: null,
  };
}

/**
 * The live, editable transaction set: statement rows enriched and patched —
 * never mutated in place, so a statement row is never silently rewritten —
 * manual rows appended, deletions dropped. Ignored rows are tagged, not
 * dropped — they still belong in the transaction list, just not in totals.
 */
export function liveTransactions(
  statementRows: Transaction[],
  manual: Transaction[],
  edits: Record<string, Partial<Transaction>>,
  deletedIds: string[],
  ignoredIds: string[],
  merchants: MerchantRule[],
): LiveTransaction[] {
  const ignored = new Set(ignoredIds);
  const enriched = enrich(statementRows, merchants);
  const patched: LiveTransaction[] = enriched.map((row) => {
    const patch = edits[row.id];
    return patch
      ? { ...row, ...patch, manual: false, edited: true, ignored: ignored.has(row.id) }
      : { ...row, manual: false, edited: false, ignored: ignored.has(row.id) };
  });
  const manualTagged: LiveTransaction[] = manual.map((row) => ({
    ...row,
    manual: true,
    edited: false,
    ignored: ignored.has(row.id),
  }));
  const deleted = new Set(deletedIds);
  return [...patched, ...manualTagged].filter((row) => !deleted.has(row.id));
}
