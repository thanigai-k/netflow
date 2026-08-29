import { useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { merchantDebits } from "../filters";
import { formatExact } from "../money";
import type { Transaction } from "../types";

export function MerchantDialog({
  merchant,
  transactions,
  onClose,
}: {
  merchant: string;
  transactions: Transaction[];
  onClose: () => void;
}) {
  const rows = useMemo(() => merchantDebits(transactions, merchant), [transactions, merchant]);
  const total = useMemo(() => rows.reduce((sum, t) => sum + t.amount, 0), [rows]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{merchant}</DialogTitle>
          <DialogDescription>
            {rows.length} transaction{rows.length === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t, index) => (
                <TableRow key={`${t.date}-${index}`}>
                  <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs">
                    {t.narration}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatExact(t.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatExact(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
