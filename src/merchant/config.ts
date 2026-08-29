/**
 * Merchant rules come entirely from public/merchants.json.
 *
 * There is deliberately NO built-in merchant knowledge anywhere in this
 * codebase: no keyword lists, no noise-word stripping, no normalisation, no
 * heuristics. A narration is whatever the bank wrote, and it is only ever
 * labelled if a rule in the config matches it. Anything unmatched stays
 * UNCATEGORISED.
 */

/** A merchant is a display name plus the strings that identify it. */
export interface MerchantRule {
  name: string;
  contains: string[];
}

/** The label for any narration no config rule claims. */
export const UNCATEGORISED = "Uncategorised";

/** Fetched at runtime, so editing the JSON needs no rebuild. */
const CONFIG_URL = `${import.meta.env.BASE_URL}merchants.json`;

export interface ConfigLoadResult {
  merchants: MerchantRule[];
  /** Human-readable problems; the valid rules still load. */
  problems: string[];
}

/** Validate the parsed JSON, keeping good rules and reporting bad ones. */
export function validateConfig(data: unknown): ConfigLoadResult {
  const problems: string[] = [];

  if (typeof data !== "object" || data === null) {
    return { merchants: [], problems: ["Config must be a JSON object."] };
  }

  const raw = (data as { merchants?: unknown }).merchants;

  if (raw === undefined) {
    return { merchants: [], problems: ['Config has no "merchants" array.'] };
  }
  if (!Array.isArray(raw)) {
    return { merchants: [], problems: ['"merchants" must be an array.'] };
  }

  const merchants: MerchantRule[] = [];

  raw.forEach((entry, index) => {
    const at = `merchants[${index}]`;

    if (typeof entry !== "object" || entry === null) {
      problems.push(`${at} is not an object.`);
      return;
    }

    const { name, contains } = entry as { name?: unknown; contains?: unknown };

    if (typeof name !== "string" || name.trim() === "") {
      problems.push(`${at} needs a non-empty "name" string.`);
      return;
    }
    if (!Array.isArray(contains)) {
      problems.push(`${at} ("${name}") needs a "contains" array of strings.`);
      return;
    }

    const keywords = contains.filter((value): value is string => {
      if (typeof value !== "string") {
        problems.push(`${at} ("${name}") has a non-string entry in "contains".`);
        return false;
      }
      if (value.trim() === "") {
        problems.push(`${at} ("${name}") has an empty string in "contains".`);
        return false;
      }
      return true;
    });

    if (keywords.length === 0) {
      problems.push(`${at} ("${name}") has no usable keywords, so it can never match.`);
      return;
    }

    merchants.push({ name: name.trim(), contains: keywords });
  });

  return { merchants, problems };
}

/** Load and validate the config file. */
export async function loadConfig(): Promise<ConfigLoadResult> {
  // Cache-busted so an edit shows up on reload rather than serving a stale copy.
  const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`);

  if (!response.ok) {
    throw new Error(`Could not load merchants.json (HTTP ${response.status}).`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new Error(
      `merchants.json is not valid JSON: ${cause instanceof Error ? cause.message : cause}`,
    );
  }

  return validateConfig(data);
}
