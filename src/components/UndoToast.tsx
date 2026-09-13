import { Button } from "@/components/ui/button";

/** Single-slot undo for the most recent delete — not a stacking toast queue. */
export function UndoToast({
  label,
  onUndo,
  onDismiss,
}: {
  label: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-popover px-4 py-3 text-popover-foreground shadow-xl ring-1 ring-foreground/5 dark:ring-foreground/10">
      <span className="max-w-[420px] truncate text-sm">Deleted “{label}”</span>
      <div className="flex flex-none items-center gap-2">
        <Button size="sm" className="rounded-full" onClick={onUndo}>
          Undo
        </Button>
        <Button size="sm" variant="ghost" className="rounded-full" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
