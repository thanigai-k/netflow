import { UNCATEGORISED, type MerchantRule } from "./config";

/**
 * Resolves a narration to a merchant name using ONLY the config rules.
 *
 * Matching is a case-insensitive substring test against the raw narration.
 * That is the whole algorithm — no normalisation, no separator handling, no
 * noise-word removal, no word boundaries. What you type in "contains" is
 * what is searched for, so a rule is predictable: if the string is visible
 * in the narration, the rule matches.
 *
 * Rules are tried in config order and the first match wins, so more
 * specific rules belong above more general ones.
 */
export class MerchantResolver {
  private readonly rules: { name: string; needles: string[] }[];

  constructor(merchants: MerchantRule[]) {
    this.rules = merchants.map((rule) => ({
      name: rule.name,
      needles: rule.contains.map((keyword) => keyword.toUpperCase()),
    }));
  }

  /** The merchant name, or UNCATEGORISED when no rule matches. */
  resolve(narration: string): string {
    const haystack = narration.toUpperCase();

    for (const rule of this.rules) {
      if (rule.needles.some((needle) => haystack.includes(needle))) {
        return rule.name;
      }
    }

    return UNCATEGORISED;
  }

  get ruleCount(): number {
    return this.rules.length;
  }
}
