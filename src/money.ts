/**
 * Money as integer paise.
 *
 * The Python original uses `Decimal`; JS has no exact decimal type and
 * floats cannot hold 0.01 exactly. Storing paise as integers keeps sums
 * exact without pulling in a bignum dependency. Safe to ~₹90 trillion.
 */
export type Paise = number;

const AMOUNT_NOISE = /[,₹\s]/g;
const DR_CR_SUFFIX = /\s*(?:dr|cr|debit|credit)\s*$/i;

/** Parse an amount cell into paise. Returns null when it isn't a number. */
export function parseAmount(value: unknown): Paise | null {
  if (value === null || value === undefined) return null;

  // SheetJS hands back real numbers for numeric cells; round to paise.
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const cleaned = String(value).replace(DR_CR_SUFFIX, "").replace(AMOUNT_NOISE, "").trim();
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/**
 * Indian-numbering currency display, matching dashboard/summary.py:format_inr.
 *   125000_00 -> ₹1.25 L      145000000_00 -> ₹14.50 Cr
 */
export function formatInr(paise: Paise): string {
  const rupees = paise / 100;
  const abs = Math.abs(rupees);

  if (abs >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;

  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

/** Full precision, for the transactions table. */
export function formatExact(paise: Paise): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
