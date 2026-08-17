import type { BudgetScenarioCompareResponse } from "@bridge-os/contracts";
import Link from "next/link";

import { formatCurrency } from "../../lib/formatters";
import { budgetScenariosHref } from "./budget-query";

interface ScenarioCompareProps {
  readonly comparison: BudgetScenarioCompareResponse;
}

export function ScenarioCompare({
  comparison
}: ScenarioCompareProps): React.ReactElement {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 px-4 pb-4 pt-4">
      <CompareColumn response={comparison.left} />
      <CompareColumn response={comparison.right} />
    </div>
  );
}

function CompareColumn({
  response
}: {
  readonly response: BudgetScenarioCompareResponse["left"];
}): React.ReactElement {
  return (
    <section
      aria-labelledby={`scenario-${response.scenario.id}`}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-border-strong bg-card"
    >
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 bg-chrome px-3 text-chrome-foreground">
        <h2
          className="m-0 truncate font-mono text-[11px] font-medium tracking-[0.14em]"
          id={`scenario-${response.scenario.id}`}
        >
          {response.scenario.name}
        </h2>
        <Link
          className="font-mono text-[10px] tracking-[0.12em] text-chrome-muted hover:text-chrome-foreground"
          href={budgetScenariosHref(response.scenario.id)}
        >
          Open
        </Link>
      </header>
      <div className="grid gap-3 p-3">
        {response.yearSummaries.map((year) => {
          const over = year.summary.budgetStatus === "OVER_BUDGET";
          return (
            <div
              className="grid grid-cols-[4.5rem_1fr_1fr] items-baseline gap-2 border border-border px-3 py-2"
              key={year.year}
            >
              <span className="font-mono text-[12px] tabular-nums">{year.year}</span>
              <span className="truncate font-mono text-[12px] tabular-nums text-muted-foreground">
                {formatMoney(year.envelope)} env
              </span>
              <span
                className={
                  over
                    ? "truncate text-right font-mono text-[12px] tabular-nums text-critical"
                    : "truncate text-right font-mono text-[12px] tabular-nums"
                }
              >
                {formatMoney(year.summary.selectedProgramValue)} ·{" "}
                {String(year.summary.includedInterventions)} items
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[4.5rem_1fr_1fr] items-baseline gap-2 border border-border border-l-[3px] border-l-warning px-3 py-2">
          <span className="font-mono text-[12px]">Backlog</span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {String(response.unassigned.count)} unassigned
          </span>
          <span className="text-right font-mono text-[12px] tabular-nums">
            {formatMoney(response.unassigned.knownCost)}
          </span>
        </div>
      </div>
    </section>
  );
}

function formatMoney(
  money: { amount: string; currency: string } | null
): string {
  return money === null ? "—" : formatCurrency(money.amount, money.currency);
}
