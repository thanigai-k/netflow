import { useCallback, useMemo, useState } from "react";

import { filterByMonth, monthSummaries } from "@/analytics";
import type { MerchantRule } from "@/merchant/config";
import { parseStatement, StatementError } from "@/parse/statement";
import { registerStatement, type StatementMeta } from "@/statements";
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
        merchants,
      ),
    [persisted.statementRows, persisted.manual, persisted.edits, persisted.deletedIds, merchants],
  );

  const months = useMemo(() => monthSummaries(allTransactions), [allTransactions]);

  // Defaults to the newest month until the user explicitly picks one (including "all").
  const selectedMonth = selectedMonthOverride ?? months[0]?.month ?? "all";

  const transactions = useMemo(
    () =>
      filterByMonth(allTransactions, selectedMonth)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allTransactions, selectedMonth],
  );

  const touchedSummary = useMemo(() => {
    const manual = transactions.filter((t) => t.manual).length;
    const edited = transactions.filter((t) => t.edited).length;
    const deleted = persisted.deletedIds.filter((id) => {
      const row =
        persisted.statementRows.find((r) => r.id === id) ??
        persisted.manual.find((r) => r.id === id);
      if (!row) return false;
      return selectedMonth === "all" || row.date.slice(0, 7) === selectedMonth;
    }).length;
    return { manual, edited, deleted };
  }, [transactions, persisted.deletedIds, persisted.statementRows, persisted.manual, selectedMonth]);

  const hasTouched = touchedSummary.manual + touchedSummary.edited + touchedSummary.deleted > 0;

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

  const undoDelete = useCallback(() => {
    if (!undo) return;
    const { id } = undo;
    persist((prev) => ({ ...prev, deletedIds: prev.deletedIds.filter((d) => d !== id) }));
    setUndo(null);
  }, [undo, persist]);

  const dismissUndo = useCallback(() => setUndo(null), []);

  return {
    hasData,
    statements: persisted.statements,
    months,
    selectedMonth,
    setSelectedMonth: setSelectedMonthOverride,
    allTransactions,
    transactions,
    touchedSummary,
    hasTouched,
    undo,
    fileError,
    loadFile,
    addTransaction,
    editTransaction,
    deleteTransaction,
    undoDelete,
    dismissUndo,
  };
}
