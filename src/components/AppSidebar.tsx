import { ArrowsClockwiseIcon, UploadSimpleIcon } from "@phosphor-icons/react";

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

export type View = "dashboard" | "transactions" | "uncategorised" | "config";

export const VIEWS: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "uncategorised", label: "Uncategorised" },
  { id: "config", label: "Config" },
];

export function AppSidebar({
  view,
  onView,
  disabled,
  uncategorised,
  fileName,
  period,
  transactionCount,
  ruleCount,
  onReload,
  onFile,
}: {
  view: View;
  onView: (view: View) => void;
  disabled: boolean;
  uncategorised: number;
  fileName: string | null;
  period: string | null;
  transactionCount: number;
  ruleCount: number;
  onReload: () => void;
  onFile: (file: File) => void;
}) {
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
        {fileName ? (
          <div className="bg-sidebar-accent text-sidebar-accent-foreground flex flex-col gap-1 rounded-xl p-4 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium" title={fileName}>
              {fileName}
            </p>
            <p className="text-muted-foreground text-xs">
              {period ? `${period} · ` : ""}
              {transactionCount} txns
            </p>
            <label
              htmlFor="sidebar-statement-file"
              className={buttonVariants({
                variant: "outline",
                className: "mt-3 w-full cursor-pointer rounded-full",
              })}
            >
              <UploadSimpleIcon data-icon="inline-start" />
              Load another statement
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
