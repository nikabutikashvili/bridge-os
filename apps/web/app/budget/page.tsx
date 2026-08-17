import type { Metadata } from "next";

import { getBudget } from "../../src/features/budget/api";
import { BudgetControls } from "../../src/features/budget/budget-controls";
import {
  parseBudgetSearchParams,
  type BudgetSearchParams
} from "../../src/features/budget/budget-query";
import { BudgetSummary } from "../../src/features/budget/budget-summary";
import { BudgetTable } from "../../src/features/budget/budget-table";
import { formatGermanDate } from "../../src/lib/formatters";

export const metadata: Metadata = { title: "Budget" };

interface BudgetPageProps {
  readonly searchParams: Promise<BudgetSearchParams>;
}

export default async function BudgetPage({
  searchParams
}: BudgetPageProps): Promise<React.ReactElement> {
  const query = parseBudgetSearchParams(await searchParams);
  const budget = await getBudget(query.year);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 font-mono text-[12px] font-medium tracking-[0.16em] text-chrome">
            OBJECT SET / BUDGET
          </h1>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(budget.data.length)} interventions
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <BudgetControls
            approvedBudget={budget.program.approvedBudget}
            availableYears={budget.availableYears}
            planningYear={budget.program.planningYear}
          />
          <p className="m-0 hidden font-mono text-[10px] tracking-[0.12em] tabular-nums text-muted-foreground xl:block">
            AS OF {formatGermanDate(budget.asOf)}
          </p>
        </div>
      </header>

      <BudgetSummary program={budget.program} summary={budget.summary} />

      <section
        aria-labelledby="budget-program-heading"
        className="mx-4 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border-strong bg-card"
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-4 bg-chrome px-3 text-chrome-foreground">
          <h2
            className="m-0 font-mono text-[11px] font-medium tracking-[0.14em] text-chrome-foreground"
            id="budget-program-heading"
          >
            PROGRAM {String(budget.program.planningYear)}
          </h2>
          <p className="m-0 font-mono text-[11px] tabular-nums text-chrome-muted">
            {String(budget.summary.includedInterventions)} included · {String(budget.data.length)} in year
          </p>
        </header>
        <BudgetTable
          planningYear={budget.program.planningYear}
          rows={budget.data}
        />
      </section>
    </div>
  );
}
