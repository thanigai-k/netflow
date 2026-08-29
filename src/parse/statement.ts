import * as XLSX from "xlsx";
import { parseAmount } from "../money";
import type { Transaction, TransactionType } from "../types";
import { columnForHeader, type CanonicalColumn } from "./columns";

export class StatementError extends Error {}

/** Control characters some bank exports embed (Python used str.isprintable). */
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return toIsoDate(value) ?? "";
  return String(value).replace(CONTROL_CHARS, "").trim();
}

function toIsoDate(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null;
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandYear(raw: string): number {
  const year = Number(raw);
  if (raw.length !== 2) return year;
  return year + (year < 70 ? 2000 : 1900);
}

/**
 * Bank statements are day-first. Ported from hdfc_base.py:_parse_date, which
 * tries explicit d/m/y formats first — never the browser's month-first
 * `new Date(string)` guess, which would read 01/02/2024 as 2 January.
 */
export function parseStatementDate(value: string): string | null {
  const numeric = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = expandYear(numeric[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    // Reject rolled-over dates like 31/02.
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return toIsoDate(date);
  }

  // "12 Jan 2024" / "12-Jan-24".
  const worded = value.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{2}|\d{4})$/);
  if (worded) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(worded[2].slice(0, 3).toLowerCase());
    if (month === -1) return null;
    return toIsoDate(new Date(expandYear(worded[3]), month, Number(worded[1])));
  }

  return null;
}

type Grid = unknown[][];

/** Read a workbook into a raw cell grid — no header row assumed. */
function readGrid(bytes: ArrayBuffer): Grid {
  // SheetJS sniffs .xls (BIFF/OLE2) vs .xlsx (zip) itself, so the two-engine
  // magic-byte switch the Python version needs collapses into one call.
  const book = XLSX.read(bytes, { cellDates: true });
  const sheetName = book.SheetNames[0];
  if (!sheetName) throw new StatementError("This workbook has no sheets.");

  return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  });
}

const DATE_COLUMNS: CanonicalColumn[] = ["post_date", "value_date"];

/** Find the row mapping to both a date column and a narration column. */
function findHeaderRow(grid: Grid): number | null {
  for (let index = 0; index < grid.length; index += 1) {
    const found = new Set<CanonicalColumn>();
    for (const cell of grid[index] ?? []) {
      const canonical = columnForHeader(cleanCell(cell));
      if (canonical) found.add(canonical);
    }
    if (DATE_COLUMNS.some((name) => found.has(name)) && found.has("details")) {
      return index;
    }
  }
  return null;
}

function rowToTransaction(
  row: Partial<Record<CanonicalColumn, unknown>>,
): Transaction | null {
  // Prefer the posted date; fall back to the value date.
  const dateCell = cleanCell(row.post_date) || cleanCell(row.value_date);
  const narration = cleanCell(row.details);
  if (!dateCell || !narration) return null;

  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateCell)
    ? dateCell
    : parseStatementDate(dateCell);
  if (!date) return null;

  const withdrawal = parseAmount(row.debit);
  const deposit = parseAmount(row.credit);

  let amount: number;
  let transactionType: TransactionType;

  if (withdrawal !== null && withdrawal !== 0) {
    amount = Math.abs(withdrawal);
    transactionType = "DEBIT";
  } else if (deposit !== null && deposit !== 0) {
    amount = Math.abs(deposit);
    transactionType = "CREDIT";
  } else {
    // Both amount columns blank or zero — a subtotal or spacer row.
    return null;
  }

  return {
    date,
    narration,
    amount,
    transactionType,
    balance: parseAmount(row.balance),
    referenceNumber: cleanCell(row.ref) || null,
    merchant: "Unknown",
  };
}

/**
 * Parse an HDFC / ICICI / SBI statement workbook into transactions.
 * Driven by canonical column names, so all three banks share one path.
 */
export function parseStatement(bytes: ArrayBuffer): Transaction[] {
  const grid = readGrid(bytes);
  const headerRow = findHeaderRow(grid);

  if (headerRow === null) {
    throw new StatementError(
      "We could not find the transaction table in this statement. Expected a " +
        "header row with a date column and a narration column.",
    );
  }

  // Column position -> canonical name, for headers we recognise.
  const byIndex = new Map<number, CanonicalColumn>();
  (grid[headerRow] ?? []).forEach((cell, index) => {
    const canonical = columnForHeader(cleanCell(cell));
    if (canonical && !byIndex.has(index)) byIndex.set(index, canonical);
  });

  const transactions: Transaction[] = [];

  for (const row of grid.slice(headerRow + 1)) {
    const record: Partial<Record<CanonicalColumn, unknown>> = {};
    for (const [index, name] of byIndex) record[name] = row[index];

    // Skip header rows repeated on later statement pages.
    const first = cleanCell(record.post_date ?? record.value_date);
    if (first && columnForHeader(first)) continue;

    const transaction = rowToTransaction(record);
    if (transaction) transactions.push(transaction);
  }

  if (transactions.length === 0) {
    throw new StatementError(
      "The statement was recognised, but no valid transactions were found.",
    );
  }

  return transactions;
}
