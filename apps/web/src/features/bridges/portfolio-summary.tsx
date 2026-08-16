import type { BridgePortfolioResponse } from "@bridge-os/contracts";

import { cn } from "@/lib/utils";

interface PortfolioSummaryProps {
  readonly summary: BridgePortfolioResponse["summary"];
}

export function PortfolioSummary({
  summary
}: PortfolioSummaryProps): React.ReactElement {
  return (
    <section
      aria-label="Portfolio attention summary"
      className="grid shrink-0 grid-cols-4 gap-3 px-4 pt-4"
    >
      <HudStat
        detail="Matching current filters"
        label="Objects"
        value={summary.structures}
      />
      <HudStat
        detail="Inspection due in 180 days or overdue"
        label="Due / overdue"
        tone={summary.inspectionsDueOrOverdue > 0 ? "warning" : "ok"}
        value={summary.inspectionsDueOrOverdue}
      />
      <HudStat
        detail="Unresolved recommendations"
        label="Open recs"
        tone={summary.withOpenRecommendations > 0 ? "warning" : "ok"}
        value={summary.withOpenRecommendations}
      />
      <HudStat
        detail="Open S, V, or D rating of 2+"
        label="SVD 2+"
        tone={summary.withNotableFindings > 0 ? "critical" : "ok"}
        value={summary.withNotableFindings}
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
