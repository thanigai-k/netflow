import { ArrowsClockwiseIcon, UploadSimpleIcon } from "@phosphor-icons/react";

import type { MonthSummary } from "@/analytics";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { monthKeyLabel } from "@/dates";
import type { StatementMeta } from "@/statements";

export type View = "dashboard" | "transactions" | "uncategorised" | "config";

export const VIEWS: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "uncategorised", label: "Uncategorised" },
  { id: "config", label: "Config" },
];

/** "June 2026 to August 2026", or just "August 2026" for a single month. */
function statementRangeLabel(months: MonthSummary[]): string | null {
  if (months.length === 0) return null;
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const first = sorted[0]!.month;
  const last = sorted[sorted.length - 1]!.month;
  return first === last ? monthKeyLabel(first) : `${monthKeyLabel(first)} to ${monthKeyLabel(last)}`;
}

export function AppSidebar({
  view,
  onView,
  disabled,
  uncategorised,
  statements,
  months,
  selectedMonth,
  ruleCount,
  onReload,
  onFile,
}: {
  view: View;
  onView: (view: View) => void;
  disabled: boolean;
  uncategorised: number;
  statements: StatementMeta[];
  months: MonthSummary[];
  selectedMonth: string;
  ruleCount: number;
  onReload: () => void;
  onFile: (file: File) => void;
}) {
  const selectedSummary =
    selectedMonth === "all"
      ? { label: "All months", count: months.reduce((sum, m) => sum + m.count, 0) }
      : { label: monthKeyLabel(selectedMonth), count: months.find((m) => m.month === selectedMonth)?.count ?? 0 };
  return (
    <Sidebar variant="inset">
      <SidebarHeader className="gap-0.5 px-4 pt-6 pb-8 group-data-[collapsible=icon]:hidden">
        <span className="truncate text-2xl font-semibold tracking-tight">Netflow</span>
        <span className="text-muted-foreground truncate text-sm">Nothing leaves your browser.</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {VIEWS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={view === item.id}
                    disabled={disabled}
                    onClick={() => onView(item.id)}
                    className="text-muted-foreground h-9 rounded-full px-4 data-[active=true]:border data-[active=true]:font-normal"
                  >
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.id === "uncategorised" && uncategorised > 0 ? (
                    <SidebarMenuBadge className="bg-sidebar-accent top-1.5 rounded-full px-2">
                      {uncategorised}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        {statements.length > 0 ? (
          <div className="bg-sidebar-accent text-sidebar-accent-foreground flex flex-col gap-1 rounded-xl p-4 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium">
              {statements.length} loaded · {statementRangeLabel(months)}
            </p>
            <p className="text-muted-foreground text-xs">
              Showing {selectedSummary.label} · {selectedSummary.count} txns
            </p>
            <label
              htmlFor="sidebar-statement-file"
              className={buttonVariants({
                variant: "outline",
                className: "mt-3 w-full cursor-pointer rounded-full",
              })}
            >
              <UploadSimpleIcon data-icon="inline-start" />
              Add a month
              <input
                id="sidebar-statement-file"
                type="file"
                accept=".xls,.xlsx"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        ) : null}
        <div className="bg-sidebar-accent flex items-center justify-between gap-2 rounded-xl py-1.5 ps-4 pe-1.5 group-data-[collapsible=icon]:hidden">
          <span className="text-muted-foreground truncate text-sm">
            {ruleCount} merchant rule{ruleCount === 1 ? "" : "s"}
          </span>
          <Button variant="ghost" size="sm" onClick={onReload}>
            <ArrowsClockwiseIcon data-icon="inline-start" />
            Reload
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
