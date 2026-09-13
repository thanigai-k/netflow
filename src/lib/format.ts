import { formatExact } from "@/money";

/** "August 2026" from an ISO date, for the hero lines. */
export function monthLabel(date: string | null): string {
  if (!date) return "this statement";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** "Sunday" from an ISO date, for the day group headers. */
export function weekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
  });
}

export const signed = (paise: number) =>
  `${paise < 0 ? "−" : "+"}${formatExact(Math.abs(paise))}`;

export const flowClass = (paise: number) =>
  paise < 0 ? "text-destructive" : "text-success";

/** "162.0 KB" — this app's data never gets big enough to need MB/GB scaling. */
export function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Cycles the chart ramp so every bar in a list gets a distinct colour. */
const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];
export const barColor = (index: number) => BAR_COLORS[index % BAR_COLORS.length];
