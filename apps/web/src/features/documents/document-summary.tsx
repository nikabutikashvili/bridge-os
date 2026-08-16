import type { DocumentOverviewResponse } from "@bridge-os/contracts";

import { cn } from "@/lib/utils";

interface DocumentSummaryProps {
  readonly summary: DocumentOverviewResponse["summary"];
}

export function DocumentSummary({
  summary
}: DocumentSummaryProps): React.ReactElement {
  const failures = summary.processingFailed + summary.extractionFailed;

  return (
    <section
      aria-label="Document and data-quality summary"
      className="grid shrink-0 grid-cols-4 gap-3 px-4 pt-4"
    >
      <HudStat
        detail={`${String(summary.linkedDocuments)} linked to bridges`}
        label="Records"
        value={summary.totalDocuments}
      />
      <HudStat
        detail={`${String(summary.extractionPending)} currently in progress`}
        label="Extracted"
        value={summary.extractionSucceeded}
      />
      <HudStat
        detail="Processing or extraction failures"
        label="Failed"
        tone={failures > 0 ? "critical" : "ok"}
        value={failures}
      />
      <HudStat
        detail={`${String(summary.extractedFindingsRequiringReview)} extracted findings awaiting review`}
        label="Attention"
        tone={summary.bridgesWithAttention > 0 ? "warning" : "ok"}
        value={summary.bridgesWithAttention}
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
