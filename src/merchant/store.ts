/**
 * Browser-side persistence for edited merchant rules.
 *
 * The site is static, so the Config tab cannot write public/merchants.json.
 * Edits are kept in localStorage and take precedence over the shipped file;
 * `toFileJson` produces exactly what belongs in that file when you want the
 * edits committed. Rule semantics live in config.ts — this file only stores.
 */
import { validateConfig, type MerchantRule } from "./config";

const KEY = "netflow.merchants";

/** Locally edited rules, or null when there are none (or they are unusable). */
export function readOverride(): MerchantRule[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null; // Private mode, storage disabled — fall back to the file.
  }
  if (raw === null) return null;

  try {
    const { merchants } = validateConfig(JSON.parse(raw));
    return merchants.length > 0 ? merchants : null;
  } catch {
    return null;
  }
}

export function writeOverride(rules: MerchantRule[]): void {
  try {
    localStorage.setItem(KEY, toFileJson(rules));
  } catch {
    // Nothing sensible to do; the in-memory rules still apply this session.
  }
}

export function clearOverride(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Same as above.
  }
}

/** The exact contents of public/merchants.json for these rules. */
export function toFileJson(rules: MerchantRule[]): string {
  return `${JSON.stringify({ merchants: rules }, null, 2)}\n`;
}
