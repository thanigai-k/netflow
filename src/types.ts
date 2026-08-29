import type { Paise } from "./money";
import { UNCATEGORISED } from "./merchant/config";

export type TransactionType = "DEBIT" | "CREDIT";

export interface Transaction {
  /** ISO yyyy-mm-dd. Bank statement dates are naive calendar dates. */
  date: string;
  narration: string;
  amount: Paise;
  transactionType: TransactionType;
  balance: Paise | null;
  referenceNumber: string | null;
  /** From the config only; UNCATEGORISED until a rule matches. */
  merchant: string;
}

export { UNCATEGORISED };
