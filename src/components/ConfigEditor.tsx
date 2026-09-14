import {
  ArrowDownIcon,
  ArrowUpIcon,
  CopyIcon,
  DownloadSimpleIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MerchantRule } from "../merchant/config";
import { toFileJson } from "../merchant/store";
import { SearchField } from "@/components/SearchField";

/** Which rule the dialog is editing: an index, or "new". */
type Editing = { index: number; rule: MerchantRule } | null;

export function ConfigEditor({
  merchants,
  onSave,
  onReset,
  edited,
  prefill,
  onPrefillConsumed,
}: {
  merchants: MerchantRule[];
  onSave: (rules: MerchantRule[]) => void;
  onReset: () => void;
  /** True when the live rules come from browser edits, not the shipped file. */
  edited: boolean;
  /** A narration to seed a brand-new rule with, sent from Uncategorised. */
  prefill: string | null;
  onPrefillConsumed: () => void;
}) {
  // index === merchants.length means "appending a new rule".
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");

  // Keeps each row's original index for match-order rank and for
  // move/edit/delete, which act on positions in the full `merchants` array.
  const q = query.trim().toLowerCase();
  const filtered = merchants
    .map((rule, index) => ({ rule, index }))
    .filter(
      ({ rule }) =>
        q === "" ||
        rule.name.toLowerCase().includes(q) ||
        rule.contains.some((keyword) => keyword.toLowerCase().includes(q)),
    );

  // A narration arriving from Uncategorised opens the dialog on a new rule.
  const open: Editing =
    editing ??
    (prefill === null
      ? null
      : { index: merchants.length, rule: { name: "", contains: [prefill] } });

  const closeDialog = () => {
    setEditing(null);
    onPrefillConsumed();
  };

  const commit = (rule: MerchantRule, index: number) => {
    const next = [...merchants];
    next[index] = rule;
    onSave(next);
    closeDialog();
  };

  const remove = (index: number) => {
    onSave(merchants.filter((_, i) => i !== index));
    setDeleting(null);
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= merchants.length) return;
    const next = [...merchants];
    [next[index], next[to]] = [next[to], next[index]];
    onSave(next);
  };

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([toFileJson(merchants)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "merchants.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copy = () => {
    void navigator.clipboard.writeText(toFileJson(merchants)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Categories, in match order</h3>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search categories"
            className="sm:w-64"
          />
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                index: merchants.length,
                rule: { name: "", contains: [] },
              })
            }
          >
            <PlusIcon /> Add category
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">#</TableHead>
            <TableHead>Category Name</TableHead>
            <TableHead>Contains</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map(({ rule, index }) => (
            <TableRow key={`${rule.name}-${index}`}>
              <TableCell className="text-right">{index + 1}</TableCell>
              <TableCell>{rule.name}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {rule.contains.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="font-mono"
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${rule.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${rule.name} down`}
                    disabled={index === merchants.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${rule.name}`}
                    onClick={() => setEditing({ index, rule })}
                  >
                    <PencilSimpleIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${rule.name}`}
                    onClick={() => setDeleting(index)}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {merchants.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No rules loaded</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No categories match &ldquo;{query}&rdquo;</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={download}>
          <DownloadSimpleIcon /> Download merchants.json
        </Button>
        <Button variant="outline" size="sm" onClick={copy}>
          <CopyIcon /> {copied ? "Copied" : "Copy JSON"}
        </Button>
        {edited ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Discard edits, use the shipped file
          </Button>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs">
        {edited
          ? "These rules are your browser edits. Download and commit the JSON to make them the default."
          : "These rules come from public/merchants.json. Editing here keeps the change in this browser only."}
      </p>

      {open ? (
        <RuleDialog
          key={open.index}
          initial={open.rule}
          isNew={open.index === merchants.length}
          onCancel={closeDialog}
          onSave={(rule) => commit(rule, open.index)}
        />
      ) : null}

      {deleting !== null ? (
        <AlertDialog open onOpenChange={(open) => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete “{merchants[deleting].name}”?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Its transactions go back to Uncategorised until another rule
                matches them. This only changes your browser copy of the config.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => remove(deleting)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

/** Add or edit one rule. Nothing is written until Save, so Cancel is a cancel. */
function RuleDialog({
  initial,
  isNew,
  onCancel,
  onSave,
}: {
  initial: MerchantRule;
  isNew: boolean;
  onCancel: () => void;
  onSave: (rule: MerchantRule) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [contains, setContains] = useState(initial.contains);
  const [keyword, setKeyword] = useState("");

  const addKeyword = () => {
    const value = keyword.trim();
    if (value === "" || contains.includes(value)) return;
    setContains([...contains, value]);
    setKeyword("");
  };

  // Same bar validateConfig sets: a name, and at least one keyword to match on.
  const valid = name.trim() !== "" && contains.length > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add category" : "Edit category"}</DialogTitle>
          <DialogDescription>
            A transaction gets this label when its narration contains any of the
            keywords below. Matching is case-insensitive.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="rule-name">Category Name</FieldLabel>
          <Input
            id="rule-name"
            value={name}
            autoFocus
            placeholder="Groceries"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="rule-keyword">Contains</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="rule-keyword"
              value={keyword}
              placeholder="SWIGGY"
              spellCheck={false}
              className="font-mono"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addKeyword();
              }}
            />
            <Button
              variant="outline"
              onClick={addKeyword}
              disabled={keyword.trim() === ""}
            >
              Add
            </Button>
          </div>
          {contains.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {contains.map((value) => (
                <Badge key={value} variant="secondary" className="font-mono">
                  {value}
                  <button
                    type="button"
                    aria-label={`Remove ${value}`}
                    className="hover:text-destructive cursor-pointer"
                    onClick={() =>
                      setContains(contains.filter((item) => item !== value))
                    }
                  >
                    <XIcon />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <FieldDescription>
            Press Enter to add a keyword. A rule with no keywords can never
            match, so at least one is required.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => onSave({ name: name.trim(), contains })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
