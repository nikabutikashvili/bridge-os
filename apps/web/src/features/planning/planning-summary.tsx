import type { PlanningResponse } from "@bridge-os/contracts";

import { cn } from "@/lib/utils";

interface PlanningSummaryProps {
  readonly summary: PlanningResponse["summary"];
}

export function PlanningSummary({
  summary
}: PlanningSummaryProps): React.ReactElement {
  const activeProgram =
    summary.planned +
    summary.budgeted +
    summary.tenderPreparation +
    summary.tenderedReady +
    summary.inProgress;
  const procurementReady = summary.tenderPreparation + summary.tenderedReady;

  return (
    <section
      aria-label="Maintenance program summary"
      className="grid shrink-0 grid-cols-4 gap-3 px-4 pt-4"
    >
      <HudStat
        detail="Source recommendations without a decision"
        label="Unplanned"
        tone={summary.recommendedUnplanned > 0 ? "warning" : "ok"}
        value={summary.recommendedUnplanned}
      />
      <HudStat
        detail="Planned through in progress"
        label="Active"
        value={activeProgram}
      />
      <HudStat
        detail="Budget allocated"
        label="Budgeted"
        value={summary.budgeted}
      />
      <HudStat
        detail="Tender preparation or ready"
        label="Procurement"
        value={procurementReady}
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
