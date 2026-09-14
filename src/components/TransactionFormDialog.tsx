import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UNCATEGORISED } from "@/merchant/config";
import { parseAmount } from "@/money";
import type { TransactionFormValues } from "@/transactions/live";
import type { Transaction } from "@/types";

function formToValues(transaction: Transaction | null, defaultDate: string): TransactionFormValues {
  if (!transaction) {
    return { type: "debit", amount: "", date: defaultDate, narration: "", category: UNCATEGORISED };
  }
  return {
    type: transaction.transactionType === "DEBIT" ? "debit" : "credit",
    amount: (transaction.amount / 100).toFixed(2),
    date: transaction.date,
    narration: transaction.narration,
    category: transaction.merchant,
  };
}

export function TransactionFormDialog({
  transaction,
  categories,
  defaultDate,
  onSave,
  onDelete,
  onClose,
}: {
  /** null when adding a brand-new transaction. */
  transaction: Transaction | null;
  /** Merchant names from merchants.json, for the Category field. */
  categories: string[];
  /** Prefilled date for a new transaction, based on the currently selected month. */
  defaultDate: string;
  onSave: (form: TransactionFormValues) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TransactionFormValues>(() =>
    formToValues(transaction, defaultDate),
  );

  const isNew = transaction === null;
  const amountValid = parseAmount(form.amount) !== null;
  const categoryItems = useMemo(() => [UNCATEGORISED, ...categories], [categories]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add transaction" : "Edit transaction"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Counts in dashboard totals like any statement row."
              : "Changes stay in this browser; the statement file is untouched."}
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel>Type</FieldLabel>
          <ToggleGroup
            spacing={0}
            variant="outline"
            className="w-full"
            value={[form.type]}
            onValueChange={(next) =>
              setForm((f) => ({ ...f, type: (next[0] as "debit" | "credit") ?? f.type }))
            }
          >
            <ToggleGroupItem value="debit" className="flex-1">
              Debit
            </ToggleGroupItem>
            <ToggleGroupItem
              value="credit"
              className="flex-1 data-[state=on]:bg-success/20 data-[state=on]:text-success"
            >
              Credit
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="txn-amount">Amount</FieldLabel>
            <Input
              id="txn-amount"
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => setForm((f) => ({ ...f, amount: event.target.value }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="txn-date">Date</FieldLabel>
            <Input
              id="txn-date"
              type="date"
              value={form.date}
              onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="txn-narration">Detail</FieldLabel>
          <Input
            id="txn-narration"
            placeholder="What was this for?"
            value={form.narration}
            onChange={(event) => setForm((f) => ({ ...f, narration: event.target.value }))}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="txn-category">Category</FieldLabel>
          <Combobox
            items={categoryItems}
            value={form.category}
            onValueChange={(value) => setForm((f) => ({ ...f, category: value ?? f.category }))}
          >
            <ComboboxInput id="txn-category" className="w-full" placeholder="Search categories…" />
            <ComboboxContent>
              <ComboboxEmpty>No category found.</ComboboxEmpty>
              <ComboboxList>
                {(name: string) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldDescription>
            Rules from merchants.json stay in charge of statement rows; this only
            overrides this one.
          </FieldDescription>
        </Field>

        <DialogFooter>
          {!isNew ? (
            <Button variant="destructive" className="sm:mr-auto" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!amountValid} onClick={() => onSave(form)}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
