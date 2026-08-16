import type { Metadata } from "next";

import { getPlanning } from "../../src/features/planning/api";
import {
  parsePlanningSearchParams,
  type PlanningSearchParams
} from "../../src/features/planning/planning-query";
import { PlanningSummary } from "../../src/features/planning/planning-summary";
import { PlanningTable } from "../../src/features/planning/planning-table";
import { PlanningTabs } from "../../src/features/planning/planning-tabs";
import { formatGermanDate } from "../../src/lib/formatters";

export const metadata: Metadata = { title: "Maintenance planning" };

interface PlanningPageProps {
  readonly searchParams: Promise<PlanningSearchParams>;
}

export default async function PlanningPage({
  searchParams
}: PlanningPageProps): Promise<React.ReactElement> {
  const query = parsePlanningSearchParams(await searchParams);
  const planning = await getPlanning(query);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 font-mono text-[12px] font-medium tracking-[0.16em] text-foreground">
            OBJECT SET / PLANNING
          </h1>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(planning.pagination.totalItems)} in view
          </p>
        </div>
        <p className="m-0 font-mono text-[10px] tracking-[0.12em] tabular-nums text-muted-foreground">
          AS OF {formatGermanDate(planning.asOf)}
        </p>
      </header>

      <PlanningSummary summary={planning.summary} />

      <section
        aria-labelledby="planning-work-heading"
        className="mx-4 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card"
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-border px-3">
          <h2
            className="m-0 font-mono text-[11px] font-medium tracking-[0.14em] text-foreground"
            id="planning-work-heading"
          >
            WORK PROGRAM
          </h2>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(planning.pagination.totalItems)} matching
          </p>
        </header>
        <PlanningTabs summary={planning.summary} view={planning.view} />
        <PlanningTable
          pagination={planning.pagination}
          rows={planning.data}
          view={planning.view}
        />
      </section>
    </div>
  );
}
