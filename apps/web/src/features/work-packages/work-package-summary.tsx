import type { WorkPackageListResponse } from "@bridge-os/contracts";

import { cn } from "@/lib/utils";

interface WorkPackageSummaryProps {
  readonly eligibleCount: number;
  readonly packages: WorkPackageListResponse["data"];
}

export function WorkPackageSummary({
  eligibleCount,
  packages
}: WorkPackageSummaryProps): React.ReactElement {
  const informationGaps = packages.reduce(
    (total, item) => total + item.readiness.missing,
    0
  );
  const readyForReview = packages.filter(
    (item) => item.readiness.missing === 0 && item.status !== "ARCHIVED"
  ).length;

  return (
    <section
      aria-label="Work package summary"
      className="grid shrink-0 grid-cols-4 gap-3 px-4 pt-4"
    >
      <HudStat
        detail="Snapshot-based handoffs"
        label="Drafts"
        value={packages.length}
      />
      <HudStat
        detail="Awaiting draft creation"
        label="Queue"
        tone={eligibleCount > 0 ? "warning" : "ok"}
        value={eligibleCount}
      />
      <HudStat
        detail="Missing recorded inputs"
        label="Gaps"
        tone={informationGaps > 0 ? "warning" : "ok"}
        value={informationGaps}
      />
      <HudStat
        detail="No missing checklist facts"
        label="Ready"
        value={readyForReview}
      />
    </section>
  );
}

function HudStat({
  detail,
  label,
  tone = "ok",
  value
}: {
  readonly detail: string;
  readonly label: string;
  readonly tone?: "critical" | "ok" | "warning";
  readonly value: number;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5 border border-border bg-card px-4 py-3",
        tone === "critical" && "border-l-[3px] border-l-critical",
        tone === "warning" && "border-l-[3px] border-l-warning"
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[34px] font-medium leading-none tabular-nums tracking-tight",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
          tone === "ok" && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-[12px] leading-4 text-muted-foreground">{detail}</span>
    </div>
  );
}
