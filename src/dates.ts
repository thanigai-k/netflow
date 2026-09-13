/** "2026-08" -> "August 2026". */
export function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}
