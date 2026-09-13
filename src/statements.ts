import type { Transaction } from "./types";

/** Metadata about one loaded statement file, for the sidebar summary. */
export interface StatementMeta {
  id: string;
  fileName: string;
  /** ISO timestamp. */
  loadedAt: string;
  rowCount: number;
}

/**
 * Namespaces a freshly parsed statement's rows under a fresh statement id,
 * so every row gets a globally stable id that survives merges and reloads.
 * `parseStatement()` only knows a row's position within its own file, not
 * which load this is — that's assigned here, once, at load time.
 */
export function registerStatement(
  rows: Transaction[],
  fileName: string,
): { statement: StatementMeta; rows: Transaction[] } {
  const statement: StatementMeta = {
    id: crypto.randomUUID(),
    fileName,
    loadedAt: new Date().toISOString(),
    rowCount: rows.length,
  };
  const namespaced = rows.map((row, index) => ({
    ...row,
    id: `${statement.id}:${index}`,
  }));
  return { statement, rows: namespaced };
}
