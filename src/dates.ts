/** "2026-08" -> "Aug 2026". */
export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}
