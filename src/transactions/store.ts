/**
 * Browser-side persistence for loaded statements and the live edits on top
 * of them (manual rows, per-row patches, deletions). Mirrors merchant/store.ts's
 * shape: a dedicated key, synchronous read/write, and a try/catch around every
 * localStorage call so private-mode/storage-disabled browsers just fall back
 * to an empty state instead of throwing.
 */
import type { StatementMeta } from "@/statements";
import type { Transaction } from "@/types";

const KEY = "netflow.transactions";

export interface PersistedTransactionState {
  statements: StatementMeta[];
  /** Raw, un-enriched — enrich() re-labels these from the live config on every read. */
  statementRows: Transaction[];
  /** Merchant is final here, set directly by the user. */
  manual: Transaction[];
  /** Keyed by statement-row id. The base row itself is never mutated. */
  edits: Record<string, Partial<Transaction>>;
  deletedIds: string[];
}

const EMPTY: PersistedTransactionState = {
  statements: [],
  statementRows: [],
  manual: [],
  edits: {},
  deletedIds: [],
};

export function readState(): PersistedTransactionState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY; // Private mode, storage disabled — start empty.
  }
  if (raw === null) return EMPTY;

  try {
    const parsed = JSON.parse(raw);
    return {
      statements: Array.isArray(parsed.statements) ? parsed.statements : [],
      statementRows: Array.isArray(parsed.statementRows) ? parsed.statementRows : [],
      manual: Array.isArray(parsed.manual) ? parsed.manual : [],
      edits: parsed.edits && typeof parsed.edits === "object" ? parsed.edits : {},
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
    };
  } catch {
    return EMPTY;
  }
}

export function writeState(state: PersistedTransactionState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Nothing sensible to do; the in-memory state still applies this session.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Same as above.
  }
}
