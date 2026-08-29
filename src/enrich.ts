import { MerchantResolver } from "./merchant/resolver";
import type { MerchantRule } from "./merchant/config";
import type { Transaction } from "./types";

/**
 * Label transactions from the config. This is the only place a merchant name
 * is ever assigned, and it does nothing beyond applying the config rules.
 */
export function enrich(
  transactions: Transaction[],
  merchants: MerchantRule[],
): Transaction[] {
  const resolver = new MerchantResolver(merchants);

  return transactions.map((transaction) => ({
    ...transaction,
    merchant: resolver.resolve(transaction.narration),
  }));
}
