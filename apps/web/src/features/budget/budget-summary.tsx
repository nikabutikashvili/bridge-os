import type { BudgetResponse } from "@bridge-os/contracts";

import { cn } from "@/lib/utils";
import { formatCurrency } from "../../lib/formatters";

interface BudgetSummaryProps {
  readonly program: BudgetResponse["program"];
  readonly summary: BudgetResponse["summary"];
}

export function BudgetSummary({
  program,
  summary
}: BudgetSummaryProps): React.ReactElement {
  const overBudget = summary.budgetStatus === "OVER_BUDGET";
  const balance = overBudget ? summary.overBudget : summary.remainingBudget;

  return (
    <div className="grid shrink-0 gap-3 px-4 pt-4">
      <section
        aria-label="Budget program summary"
        className="grid grid-cols-4 gap-3"
      >
        <HudStat
          compact
          detail={`${String(program.planningYear)} approved envelope`}
          label="Available"
          value={formatMoney(program.approvedBudget)}
        />
        <HudStat
          compact
          detail="Known costs for included interventions"
          label="Program value"
          value={formatMoney(summary.selectedProgramValue)}
        />
        <HudStat
          compact
          detail={
            summary.budgetStatus === "NOT_SET"
              ? "Set a budget to calculate capacity"
              : overBudget
                ? "Selected known costs exceed budget"
                : "Capacity after selected known costs"
          }
          label={overBudget ? "Over budget" : "Remaining"}
          tone={overBudget ? "critical" : "ok"}
          value={formatMoney(balance)}
        />
        <HudStat
          detail={`${String(summary.includedInterventions)} included in program`}
          label="Funded"
          tone={summary.missingEstimateCount > 0 ? "warning" : "ok"}
          value={summary.fundedInterventions}
        />
      </section>
      {summary.missingEstimateCount > 0 ? (
        <p
          className="m-0 border border-border border-l-[3px] border-l-warning bg-card px-3 py-2 text-[12px] leading-4 text-muted-foreground"
          role="status"
        >
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-warning">
            Estimate gap
          </span>
          {" · "}
          {String(summary.missingEstimateCount)} included{" "}
          {summary.missingEstimateCount === 1 ? "intervention has" : "interventions have"} no
          usable estimate. Program value and remaining budget include known costs only.
        </p>
      ) : null}
    </div>
  );
}

function HudStat({
  compact = false,
  detail,
  label,
  tone = "ok",
  value
}: {
  readonly compact?: boolean;
  readonly detail: string;
  readonly label: string;
  readonly tone?: "critical" | "ok" | "warning";
  readonly value: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5 border border-border-strong bg-card px-4 py-3",
        tone === "critical" && "border-l-[3px] border-l-critical",
        tone === "warning" && "border-l-[3px] border-l-warning"
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-chrome">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono font-medium leading-none tabular-nums tracking-tight",
          compact ? "text-[22px]" : "text-[34px]",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
          tone === "ok" && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="truncate text-[12px] leading-4 text-muted-foreground">{detail}</span>
    </div>
  );
}

function formatMoney(
  money: { amount: string; currency: string } | null
): string {
  return money === null ? "—" : formatCurrency(money.amount, money.currency);
}
