import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface HeroStat {
  label: string;
  value: string;
  className?: string;
}

/**
 * The per-view page header. Replaces the old app-wide top bar, so it also
 * carries the sidebar trigger on small screens where the sidebar is a sheet.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  stats,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: HeroStat[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex items-start gap-2">
        <SidebarTrigger className="mt-1 md:hidden" />
        <div className="flex flex-col gap-1">
          {eyebrow ? (
            <p className="text-muted-foreground text-sm">{eyebrow}</p>
          ) : null}
          <h1 className="text-4xl font-semibold tracking-tight tabular-nums">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {stats && stats.length > 0 ? (
        <dl className="flex flex-wrap gap-x-10 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 text-right">
              <dt className="text-muted-foreground text-sm">{stat.label}</dt>
              <dd
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  stat.className,
                )}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
