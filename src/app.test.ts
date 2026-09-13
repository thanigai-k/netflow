import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildSummary,
  coverage,
  filterByMonth,
  groupByDate,
  merchantSummary,
  monthSummaries,
} from "./analytics";
import { monthKeyLabel } from "./dates";
import { enrich } from "./enrich";
import { matchesFilters, merchantDebits, searchMerchants } from "./filters";
import { UNCATEGORISED, validateConfig, type MerchantRule } from "./merchant/config";
import { MerchantResolver } from "./merchant/resolver";
import { clearOverride, readOverride, toFileJson, writeOverride } from "./merchant/store";
import { formatInr, parseAmount } from "./money";
import { parseStatement, parseStatementDate } from "./parse/statement";
import { registerStatement } from "./statements";

function loadSample(bank: "hdfc" | "icici", merchants: MerchantRule[] = []) {
  const bytes = readFileSync(`src/fixtures/sample_statement_${bank}.xlsx`);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return enrich(parseStatement(buffer as ArrayBuffer), merchants);
}

/** The real config that ships in public/. */
function shippedConfig(): MerchantRule[] {
  const { merchants, problems } = validateConfig(
    JSON.parse(readFileSync("public/merchants.json", "utf-8")),
  );
  expect(problems).toEqual([]);
  return merchants;
}

describe("no built-in merchant logic", () => {
  it("labels everything Uncategorised with an empty config", () => {
    const transactions = loadSample("icici", []);
    expect(transactions).toHaveLength(230);
    expect(transactions.every((t) => t.merchant === UNCATEGORISED)).toBe(true);
  });

  it("recognises nothing that isn't in the config", () => {
    const resolver = new MerchantResolver([]);
    // All of these were hardcoded in the Python version. None survive.
    for (const narration of [
      "UPI/SWIGGY/UPIPayment/ICICI Bank",
      "UPI/ZERODHA/UPIPayment",
      "ATW BANGALORE CASH",
      "NEFT DR MY PPF",
      "ICICIPRULIFE PREMIUM",
      "AMAZON",
    ]) {
      expect(resolver.resolve(narration)).toBe(UNCATEGORISED);
    }
  });

  it("adding a config rule changes the data, with nothing else touched", () => {
    const before = coverage(loadSample("icici", []));
    expect(before.categorised).toBe(0);

    const after = coverage(loadSample("icici", [{ name: "Swiggy", contains: ["SWIGGY"] }]));
    expect(after.categorised).toBeGreaterThan(0);
    expect(after.total).toBe(before.total);
  });
});

describe("matching is a literal substring test", () => {
  it('matches "UPI/" literally — nothing is stripped', () => {
    const resolver = new MerchantResolver([
      { name: "UPI Transactions", contains: ["UPI/"] },
    ]);
    expect(resolver.resolve("UPI/SWIGGY/UPIPayment/ICICI Bank")).toBe("UPI Transactions");
    // The separator is part of the needle, so a bare "UPI" narration misses.
    expect(resolver.resolve("UPI-SWIGGY-123")).toBe(UNCATEGORISED);
  });

  it("is case-insensitive", () => {
    const resolver = new MerchantResolver([{ name: "Fruits", contains: ["fruits"] }]);
    expect(resolver.resolve("UPI/FRUITS SHOP/Payment")).toBe("Fruits");
  });

  it("matches mid-word, with no word-boundary rule", () => {
    const resolver = new MerchantResolver([{ name: "ACT", contains: ["ACTFIBER"] }]);
    expect(resolver.resolve("UPI/ACTFIBERNET/0001")).toBe("ACT");
  });

  it("matches if ANY keyword in contains hits", () => {
    const resolver = new MerchantResolver([
      { name: "Fruits", contains: ["FRUITS", "FRUIT CENTRE"] },
    ]);
    expect(resolver.resolve("UPI/FRESH FRUIT CENTRE/Pay")).toBe("Fruits");
    expect(resolver.resolve("UPI/FRUITS SHOP/Pay")).toBe("Fruits");
  });

  it("gives the first matching rule in config order", () => {
    const narration = "UPI/FRUITS SHOP/Payment/Google Pay";
    const fruitsFirst: MerchantRule[] = [
      { name: "Fruits", contains: ["FRUITS"] },
      { name: "Google Pay", contains: ["GOOGLE PAY"] },
    ];
    const gpayFirst = [...fruitsFirst].reverse();

    expect(new MerchantResolver(fruitsFirst).resolve(narration)).toBe("Fruits");
    expect(new MerchantResolver(gpayFirst).resolve(narration)).toBe("Google Pay");
  });
});

describe("config validation", () => {
  it("accepts the shipped config", () => {
    expect(shippedConfig().length).toBeGreaterThan(0);
  });

  it("keeps good rules and reports bad ones", () => {
    const result = validateConfig({
      merchants: [
        { name: "Good", contains: ["OK"] },
        { name: "", contains: ["X"] },
        { name: "No keywords", contains: [] },
        { name: "Wrong type", contains: "SWIGGY" },
        { name: "Blank keyword", contains: [""] },
        "not an object",
      ],
    });

    expect(result.merchants).toEqual([{ name: "Good", contains: ["OK"] }]);
    // 6, not 5: the blank keyword reports twice — the empty string itself,
    // then the rule having no usable keywords left.
    expect(result.problems).toHaveLength(6);
  });

  it("reports a missing or malformed merchants array", () => {
    expect(validateConfig({}).problems).toEqual(['Config has no "merchants" array.']);
    expect(validateConfig({ merchants: {} }).problems).toEqual([
      '"merchants" must be an array.',
    ]);
    expect(validateConfig(null).problems).toEqual(["Config must be a JSON object."]);
  });

  it("trims names and ignores non-string keywords", () => {
    const { merchants } = validateConfig({
      merchants: [{ name: "  Padded  ", contains: ["A", 7, "B"] }],
    });
    expect(merchants).toEqual([{ name: "Padded", contains: ["A", "B"] }]);
  });
});

describe("statement parsing is unchanged", () => {
  it.each(["hdfc", "icici"] as const)("%s totals match the Python pipeline", (bank) => {
    const summary = buildSummary(loadSample(bank));
    expect(summary.transactionCount).toBe(230);
    expect(summary.totalDebit).toBe(383_213_00);
    expect(summary.totalCredit).toBe(1_521_570_00);
    expect(summary.monthCount).toBe(12);
  });

  it("ranks merchants by spend, highest first", () => {
    // Deliberately config-agnostic: merchants.json is the user's file and its
    // contents will change, so assert the shape rather than specific names.
    const rows = merchantSummary(loadSample("icici", shippedConfig()), null);
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].spend).toBeGreaterThanOrEqual(rows[i].spend);
    }
    // Every labelled row must come from a rule actually in the config.
    const names = new Set([...shippedConfig().map((r) => r.name), UNCATEGORISED]);
    for (const row of rows) expect(names.has(row.merchant)).toBe(true);
  });

  it("reads dates day-first, not month-first", () => {
    expect(parseStatementDate("01/02/2024")).toBe("2024-02-01");
    expect(parseStatementDate("05-03-24")).toBe("2024-03-05");
    expect(parseStatementDate("12-Jan-2024")).toBe("2024-01-12");
    expect(parseStatementDate("31/02/2024")).toBeNull();
  });
});

describe("month filtering", () => {
  const row = (id: string, date: string, amount: number, transactionType: "DEBIT" | "CREDIT") => ({
    id,
    date,
    narration: "n",
    amount,
    transactionType,
    balance: null,
    referenceNumber: null,
    merchant: "UPI",
  });

  const txns = [
    row("1", "2026-08-01", 100, "DEBIT"),
    row("2", "2026-08-15", 200, "CREDIT"),
    row("3", "2026-07-20", 50, "DEBIT"),
    row("4", "2026-07-21", 30, "DEBIT"),
  ];

  it("buckets by calendar month, newest first, debit-only totals", () => {
    expect(monthSummaries(txns)).toEqual([
      { month: "2026-08", count: 2, totalDebit: 100 },
      { month: "2026-07", count: 2, totalDebit: 80 },
    ]);
  });

  it("filters to one month, or passes everything through for \"all\"", () => {
    expect(filterByMonth(txns, "2026-08").map((t) => t.id)).toEqual(["1", "2"]);
    expect(filterByMonth(txns, "all")).toHaveLength(4);
  });

  it("formats a month key as a human label", () => {
    expect(monthKeyLabel("2026-08")).toBe("August 2026");
  });
});

describe("registerStatement", () => {
  const rows = () => [
    { id: "0", date: "2026-08-01", narration: "A", amount: 100, transactionType: "DEBIT" as const, balance: null, referenceNumber: null, merchant: "X" },
    { id: "1", date: "2026-08-02", narration: "B", amount: 200, transactionType: "DEBIT" as const, balance: null, referenceNumber: null, merchant: "X" },
  ];

  it("namespaces row ids under a fresh statement id, in order", () => {
    const { statement, rows: namespaced } = registerStatement(rows(), "a.xlsx");
    expect(namespaced.map((r) => r.id)).toEqual([`${statement.id}:0`, `${statement.id}:1`]);
    expect(statement.fileName).toBe("a.xlsx");
    expect(statement.rowCount).toBe(2);
  });

  it("gives two loads of the same rows distinct ids", () => {
    const first = registerStatement(rows(), "a.xlsx");
    const second = registerStatement(rows(), "a.xlsx");
    expect(first.statement.id).not.toBe(second.statement.id);
    expect(first.rows[0]!.id).not.toBe(second.rows[0]!.id);
  });
});

describe("money", () => {
  it("keeps sums exact where floats would drift", () => {
    expect(parseAmount("0.10")! + parseAmount("0.20")!).toBe(parseAmount("0.30"));
  });

  it("strips separators, symbols and Dr/Cr suffixes", () => {
    expect(parseAmount("1,234.56")).toBe(123456);
    expect(parseAmount("₹ 1,234.56")).toBe(123456);
    expect(parseAmount("500.00 Dr")).toBe(50000);
    expect(parseAmount("abc")).toBeNull();
  });

  it("formats in the Indian numbering system", () => {
    expect(formatInr(1_250_00)).toBe("₹1,250");
    expect(formatInr(1_25_000_00)).toBe("₹1.25 L");
    expect(formatInr(14_50_00_000_00)).toBe("₹14.50 Cr");
  });
});

describe("filters", () => {
  const txns = enrich(
    [
      { id: "1", date: "2026-08-01", narration: "SWIGGY ORDER", amount: 30000, transactionType: "DEBIT", balance: null, referenceNumber: null, merchant: "Swiggy" },
      { id: "2", date: "2026-08-03", narration: "SWIGGY REFUND", amount: 10000, transactionType: "CREDIT", balance: null, referenceNumber: null, merchant: "Swiggy" },
      { id: "3", date: "2026-08-02", narration: "SWIGGY LATE", amount: 20000, transactionType: "DEBIT", balance: null, referenceNumber: null, merchant: "Swiggy" },
      { id: "4", date: "2026-08-04", narration: "UPI/RANDOM", amount: 5000, transactionType: "DEBIT", balance: null, referenceNumber: null, merchant: "UPI" },
    ],
    [{ name: "Swiggy", contains: ["SWIGGY"] }, { name: "UPI", contains: ["UPI/"] }],
  );

  it("falls back to the top N when the merchant search is empty", () => {
    const all = merchantSummary(txns, null);
    expect(searchMerchants(all, "  ", 1)).toHaveLength(1);
    expect(searchMerchants(all, "swig").map((r) => r.merchant)).toEqual(["Swiggy"]);
    expect(searchMerchants(all, "nope")).toEqual([]);
  });

  it("combines the narration search with the merchant multi-select", () => {
    const t = txns[0]!;
    expect(matchesFilters(t, "", [])).toBe(true);
    expect(matchesFilters(t, "", ["UPI"])).toBe(false);
    expect(matchesFilters(t, "order", ["Swiggy"])).toBe(true);
    expect(matchesFilters(t, "refund", ["Swiggy"])).toBe(false);
    // The merchant name itself is searchable, not just the narration.
    expect(matchesFilters(t, "swiggy", [])).toBe(true);
  });

  it("drills into debits only, newest first, so the total matches the leaderboard", () => {
    const rows = merchantDebits(txns, "Swiggy");
    expect(rows.map((t) => t.date)).toEqual(["2026-08-02", "2026-08-01"]);
    const total = rows.reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(merchantSummary(txns, null).find((r) => r.merchant === "Swiggy")!.spend);
  });
});

describe("groupByDate", () => {
  let nextId = 0;
  const row = (date: string, amount: number, transactionType: "DEBIT" | "CREDIT") => ({
    id: String(nextId++),
    date,
    narration: "n",
    amount,
    transactionType,
    balance: null,
    referenceNumber: null,
    merchant: "UPI",
  });

  it("folds consecutive equal dates and nets credits against debits", () => {
    const groups = groupByDate([
      row("2026-08-03", 30000, "DEBIT"),
      row("2026-08-03", 50000, "CREDIT"),
      row("2026-08-02", 20000, "DEBIT"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-08-03", "2026-08-02"]);
    expect(groups[0]!.rows).toHaveLength(2);
    expect(groups[0]!.net).toBe(20000);
    expect(groups[1]!.net).toBe(-20000);
  });

  it("returns no groups for no rows", () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe("config store", () => {
  // vitest runs in node, so stand in for the browser's localStorage.
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };

  const rules: MerchantRule[] = [{ name: "Swiggy", contains: ["SWIGGY"] }];

  it("round-trips saved rules", () => {
    clearOverride();
    expect(readOverride()).toBeNull();
    writeOverride(rules);
    expect(readOverride()).toEqual(rules);
    clearOverride();
    expect(readOverride()).toBeNull();
  });

  it("writes what merchants.json expects", () => {
    expect(validateConfig(JSON.parse(toFileJson(rules)))).toEqual({
      merchants: rules,
      problems: [],
    });
  });

  it("falls back to the file when storage holds garbage", () => {
    store.set("netflow.merchants", "{not json");
    expect(readOverride()).toBeNull();
    store.set("netflow.merchants", JSON.stringify({ merchants: [] }));
    expect(readOverride()).toBeNull();
    clearOverride();
  });
});
