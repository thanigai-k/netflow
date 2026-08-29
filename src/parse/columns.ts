/**
 * Canonical column names, ported from parser/sbi_base.py and
 * parser/icici_base.py. Column NAMES matter, never positions — banks ship
 * several layouts of the same statement.
 */
export type CanonicalColumn =
  | "value_date" | "post_date" | "details" | "ref" | "debit" | "credit" | "balance";

const ALIASES: Record<string, CanonicalColumn> = {
  // Dates.
  value: "value_date", valuedate: "value_date", "value date": "value_date",
  dated: "value_date",
  date: "post_date", post: "post_date", postdate: "post_date", "post date": "post_date",
  txndate: "post_date", "txn date": "post_date",
  transaction: "post_date", transactiondate: "post_date", "transaction date": "post_date",
  businessdate: "post_date", "business date": "post_date",
  // Narration.
  details: "details", narration: "details", description: "details",
  particulars: "details", remarks: "details", txndetails: "details",
  transactionremarks: "details", "transaction remarks": "details",
  "description of transaction": "details",
  // Reference / cheque.
  ref: "ref", refno: "ref", "ref no": "ref", "ref.no": "ref", refnumber: "ref",
  refnochequeno: "ref", cheque: "ref", chequeno: "ref", chequenumber: "ref",
  "cheque number": "ref", chq: "ref", chqno: "ref", chqref: "ref",
  chqrefno: "ref", chqnoref: "ref",
  // Debit.
  debit: "debit", debitamt: "debit", "debit amt": "debit",
  debitamount: "debit", "debit amount": "debit", dr: "debit",
  withdrawal: "debit", withdrawals: "debit",
  withdrawalamt: "debit", "withdrawal amt": "debit",
  withdrawalamount: "debit", "withdrawal amount": "debit",
  withdrawalamountinr: "debit", "withdrawal amountinr": "debit",
  withdrawalamtinr: "debit",
  // Credit.
  credit: "credit", creditamt: "credit", "credit amt": "credit",
  creditamount: "credit", "credit amount": "credit", cr: "credit",
  deposit: "credit", deposits: "credit",
  depositamt: "credit", "deposit amt": "credit",
  depositamount: "credit", "deposit amount": "credit",
  depositamountinr: "credit", "deposit amountinr": "credit",
  depositamtinr: "credit",
  // Balance.
  balance: "balance", closingbalance: "balance", runningbalance: "balance",
  availablebalance: "balance",
};

/** Lowercase, drop the ₹ symbol and punctuation, keeping alphanumerics/spaces. */
export function normalizeHeader(header: string): string {
  return Array.from(header)
    .filter((c) => /[\p{L}\p{N}]/u.test(c) || /\s/.test(c))
    .join("")
    .toLowerCase()
    .trim();
}

/** Map a raw header cell to a canonical column, or null if unrecognised. */
export function columnForHeader(header: string): CanonicalColumn | null {
  const text = normalizeHeader(header);
  if (text in ALIASES) return ALIASES[text];

  // Catch variants like "ValueDate".
  const compact = text.replace(/\s+/g, "");
  return compact in ALIASES ? ALIASES[compact] : null;
}
