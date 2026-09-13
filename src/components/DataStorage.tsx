import { UploadSimpleIcon, WarningIcon } from "@phosphor-icons/react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthKeyLabel } from "@/dates";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatExact } from "@/money";
import type { MonthStorageRow } from "@/storage";
import { PageHero } from "./PageHero";

export function DataStorage({
  monthRows,
  totalBytes,
  manualCount,
  ruleCount,
  onUpload,
  onDeleteMonth,
  onDeleteAll,
}: {
  monthRows: MonthStorageRow[];
  totalBytes: number;
  manualCount: number;
  ruleCount: number;
  onUpload: (file: File) => void;
  onDeleteMonth: (month: string) => void;
  onDeleteAll: () => void;
}) {
  const totalRows = monthRows.reduce((sum, row) => sum + row.rowCount, 0);

  return (
    <>
      <PageHero
        title="Data & storage"
        subtitle={`${monthRows.length} month${monthRows.length === 1 ? "" : "s"} · ${totalRows} transaction${totalRows === 1 ? "" : "s"} · ${formatBytes(totalBytes)} held in this browser's local storage. Nothing is on a server, so deleting here is the only copy gone.`}
        actions={
          <FieldLabel
            htmlFor="storage-statement-file"
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer rounded-full")}
          >
            <UploadSimpleIcon data-icon="inline-start" />
            Upload statement
            <input
              id="storage-statement-file"
              type="file"
              accept=".xls,.xlsx"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
            />
          </FieldLabel>
        }
      />

      <div className="grid grid-cols-1 gap-6 @3xl/main:grid-cols-[1fr_320px]">
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRows.map((row) => (
                  <MonthRow key={row.month} row={row} onDelete={() => onDeleteMonth(row.month)} />
                ))}
              </TableBody>
            </Table>
            {monthRows.length > 0 ? (
              <p className="text-muted-foreground mt-4 text-sm">
                Deleting a month removes its transactions, including any you added by hand.
                Category rules stay.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>What&apos;s stored</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="flex flex-col gap-2 text-sm">
                <StatRow label="Statement months" value={`${monthRows.length}`} />
                <StatRow label="Manual transactions" value={`${manualCount}`} />
                <StatRow label="Category rules" value={`${ruleCount}`} />
              </dl>
              <Separator />
              <dl>
                <StatRow label="Total" value={formatBytes(totalBytes)} bold />
              </dl>
            </CardContent>
          </Card>

          <DeleteEverythingCard onConfirm={onDeleteAll} />
        </div>
      </div>
    </>
  );
}

function StatRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", bold && "text-base font-semibold")}>{value}</dd>
    </div>
  );
}

function MonthRow({ row, onDelete }: { row: MonthStorageRow; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const label = monthKeyLabel(row.month);

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {row.sources.length > 0 ? row.sources.join(", ") : "Manually added"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.rowCount}</TableCell>
      <TableCell className="text-right tabular-nums">{formatExact(row.totalDebit)}</TableCell>
      <TableCell className="text-muted-foreground text-right tabular-nums">
        {formatBytes(row.bytes)}
      </TableCell>
      <TableCell className="text-right">
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
            Delete month
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently removes {row.rowCount} transaction{row.rowCount === 1 ? "" : "s"},
                including any added by hand. Category rules stay. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function DeleteEverythingCard({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canDelete = confirmText.trim().toLowerCase() === "delete";

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WarningIcon className="text-destructive" />
          Delete everything
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Clears all months, manual transactions and category rules, and returns the app to the
          upload screen. Asks you to type <code>delete</code> first.
        </p>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setConfirmText("");
          }}
        >
          <AlertDialogTrigger render={<Button variant="destructive" className="self-start" />}>
            Delete all data
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all data?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears every statement, manual transaction and category rule from this
                browser. There is no undo. Type <strong>delete</strong> to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="confirm-delete-all" className="sr-only">
                Type delete to confirm
              </FieldLabel>
              <Input
                id="confirm-delete-all"
                autoComplete="off"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="delete"
              />
              <FieldDescription>Case doesn&apos;t matter.</FieldDescription>
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!canDelete}
                onClick={() => {
                  onConfirm();
                  setOpen(false);
                }}
              >
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
