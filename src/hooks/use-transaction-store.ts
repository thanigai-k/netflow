import { useCallback, useMemo, useState } from "react";

import { filterByMonth, monthSummaries } from "@/analytics";
import type { MerchantRule } from "@/merchant/config";
import { parseStatement, StatementError } from "@/parse/statement";
import { registerStatement, type StatementMeta } from "@/statements";
import { monthStorageRows, totalStorageBytes } from "@/storage";
import { readState, writeState, type PersistedTransactionState } from "@/transactions/store";
import {
  buildPatch,
  dedupeAgainst,
  liveTransactions,
  type LiveTransaction,
  type TransactionFormValues,
} from "@/transactions/live";

export interface UndoState {
  id: string;
  label: string;
}

export function useTransactionStore(merchants: MerchantRule[]) {
  const [persisted, setPersistedRaw] = useState<PersistedTransactionState>(() => readState());
  const [fileError, setFileError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [selectedMonthOverride, setSelectedMonthOverride] = useState<string | null>(null);

  const persist = useCallback(
    (updater: (prev: PersistedTransactionState) => PersistedTransactionState) => {
      setPersistedRaw((prev) => {
        const next = updater(prev);
        writeState(next);
        return next;
      });
    },
    [],
  );

  const hasData = persisted.statementRows.length > 0 || persisted.manual.length > 0;

  const allTransactions = useMemo<LiveTransaction[]>(
    () =>
      liveTransactions(
        persisted.statementRows,
        persisted.manual,
        persisted.edits,
        persisted.deletedIds,
        persisted.ignoredIds,
        merchants,
      ),
    [
      persisted.statementRows,
      persisted.manual,
      persisted.edits,
      persisted.deletedIds,
      persisted.ignoredIds,
      merchants,
    ],
  );

  // Excludes ignored rows — the set every spend number (charts, coverage,
  // storage totals) should be computed from. The row list itself still uses
  // allTransactions/transactions so ignored rows stay visible there.
  const visibleAllTransactions = useMemo(
    () => allTransactions.filter((t) => !t.ignored),
    [allTransactions],
  );

  const months = useMemo(() => monthSummaries(allTransactions), [allTransactions]);

  const monthRows = useMemo(
    () => monthStorageRows(persisted, visibleAllTransactions),
    [persisted, visibleAllTransactions],
  );

  // Cheap enough (two localStorage reads + Blob sizing) to recompute on every
  // render rather than fight useMemo's dep-tracking for a value with no inputs.
  const totalBytes = totalStorageBytes();

  // Defaults to the newest month until the user explicitly picks one (including "all").
  const selectedMonth = selectedMonthOverride ?? months[0]?.month ?? "all";

  const transactions = useMemo(
    () =>
      filterByMonth(allTransactions, selectedMonth)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allTransactions, selectedMonth],
  );

  // Dashboard's spend numbers — same month slice, ignored rows dropped.
  const visibleTransactions = useMemo(
    () => transactions.filter((t) => !t.ignored),
    [transactions],
  );

  const touchedSummary = useMemo(() => {
    const manual = transactions.filter((t) => t.manual).length;
    const edited = transactions.filter((t) => t.edited).length;
    const ignored = transactions.filter((t) => t.ignored).length;
    const deleted = persisted.deletedIds.filter((id) => {
      const row =
        persisted.statementRows.find((r) => r.id === id) ??
        persisted.manual.find((r) => r.id === id);
      if (!row) return false;
      return selectedMonth === "all" || row.date.slice(0, 7) === selectedMonth;
    }).length;
    return { manual, edited, deleted, ignored };
  }, [transactions, persisted.deletedIds, persisted.statementRows, persisted.manual, selectedMonth]);

  const hasTouched =
    touchedSummary.manual + touchedSummary.edited + touchedSummary.deleted + touchedSummary.ignored >
    0;

  const loadFile = useCallback(
    async (file: File): Promise<boolean> => {
      setFileError(null);
      try {
        const parsed = parseStatement(await file.arrayBuffer());
        const { statement, rows } = registerStatement(parsed, file.name);
        persist((prev) => {
          const deduped = dedupeAgainst([...prev.statementRows, ...prev.manual], rows);
          const registered: StatementMeta = { ...statement, rowCount: deduped.length };
          return {
            ...prev,
            statements: [...prev.statements, registered],
            statementRows: [...prev.statementRows, ...deduped],
          };
        });
        return true;
      } catch (cause) {
        setFileError(
          cause instanceof StatementError
            ? cause.message
            : `Could not read this file. ${cause instanceof Error ? cause.message : ""}`,
        );
        return false;
      }
    },
    [persist],
  );

  const addTransaction = useCallback(
    (form: TransactionFormValues) => {
      const row = { id: `manual:${crypto.randomUUID()}`, ...buildPatch(form) };
      persist((prev) => ({ ...prev, manual: [...prev.manual, row] }));
    },
    [persist],
  );

  const editTransaction = useCallback(
    (id: string, form: TransactionFormValues) => {
      const patch = buildPatch(form);
      persist((prev) => {
        const isManual = prev.manual.some((r) => r.id === id);
        if (isManual) {
          return {
            ...prev,
            manual: prev.manual.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          };
        }
        return { ...prev, edits: { ...prev.edits, [id]: patch } };
      });
    },
    [persist],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const row =
        persisted.manual.find((r) => r.id === id) ??
        persisted.statementRows.find((r) => r.id === id);
      if (!row) return;
      setUndo({ id, label: row.narration.slice(0, 44) });
      persist((prev) =>
        prev.deletedIds.includes(id) ? prev : { ...prev, deletedIds: [...prev.deletedIds, id] },
      );
    },
    [persisted.manual, persisted.statementRows, persist],
  );

  const deleteMonth = useCallback(
    (month: string) => {
      persist((prev) => {
        const keep = (row: { id: string; date: string }) => row.date.slice(0, 7) !== month;
        const statementRows = prev.statementRows.filter(keep);
        const manual = prev.manual.filter(keep);

        const remainingIds = new Set([...statementRows, ...manual].map((r) => r.id));
        const edits = Object.fromEntries(
          Object.entries(prev.edits).filter(([id]) => remainingIds.has(id)),
        );
        const deletedIds = prev.deletedIds.filter((id) => remainingIds.has(id));
        const ignoredIds = prev.ignoredIds.filter((id) => remainingIds.has(id));

        const remainingCountByStatement = new Map<string, number>();
        for (const row of statementRows) {
          const statementId = row.id.split(":")[0]!;
          remainingCountByStatement.set(statementId, (remainingCountByStatement.get(statementId) ?? 0) + 1);
        }
        const statements = prev.statements
          .map((s) => ({ ...s, rowCount: remainingCountByStatement.get(s.id) ?? 0 }))
          .filter((s) => s.rowCount > 0);

        return { statements, statementRows, manual, edits, deletedIds, ignoredIds };
      });
    },
    [persist],
  );

  const deleteAll = useCallback(() => {
    persist(() => ({
      statements: [],
      statementRows: [],
      manual: [],
      edits: {},
      deletedIds: [],
      ignoredIds: [],
    }));
  }, [persist]);

  const undoDelete = useCallback(() => {
    if (!undo) return;
    const { id } = undo;
    persist((prev) => ({ ...prev, deletedIds: prev.deletedIds.filter((d) => d !== id) }));
    setUndo(null);
  }, [undo, persist]);

  const toggleIgnore = useCallback(
    (id: string) => {
      persist((prev) => ({
        ...prev,
        ignoredIds: prev.ignoredIds.includes(id)
          ? prev.ignoredIds.filter((i) => i !== id)
          : [...prev.ignoredIds, id],
      }));
    },
    [persist],
  );

  const dismissUndo = useCallback(() => setUndo(null), []);

  return {
    hasData,
    persisted,
    statements: persisted.statements,
    months,
    monthRows,
    totalBytes,
    selectedMonth,
    setSelectedMonth: setSelectedMonthOverride,
    allTransactions,
    visibleAllTransactions,
    transactions,
    visibleTransactions,
    touchedSummary,
    hasTouched,
    undo,
    fileError,
    loadFile,
    addTransaction,
    editTransaction,
    deleteTransaction,
    toggleIgnore,
    deleteMonth,
    deleteAll,
    undoDelete,
    dismissUndo,
  };
}
