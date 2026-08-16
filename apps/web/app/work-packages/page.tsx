import type { Metadata } from "next";

import { getWorkPackages } from "../../src/features/work-packages/api";
import { WorkPackageSummary } from "../../src/features/work-packages/work-package-summary";
import { WorkPackageTabs } from "../../src/features/work-packages/work-package-tabs";
import {
  EligibleInterventionsTable,
  WorkPackageDraftTable
} from "../../src/features/work-packages/work-package-register";
import { parseWorkPackageView } from "../../src/features/work-packages/work-package-query";

export const metadata: Metadata = { title: "Work Packages" };
export const dynamic = "force-dynamic";

interface WorkPackagesPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorkPackagesPage({
  searchParams
}: WorkPackagesPageProps): Promise<React.ReactElement> {
  const query = await searchParams;
  const view = parseWorkPackageView(query["view"]);
  const response = await getWorkPackages();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 font-mono text-[12px] font-medium tracking-[0.16em] text-foreground">
            OBJECT SET / WORK PACKAGES
          </h1>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(response.data.length)} drafts
          </p>
        </div>
      </header>

      <WorkPackageSummary
        eligibleCount={response.eligibleInterventions.length}
        packages={response.data}
      />

      <p
        className="mx-4 mt-3 border border-border border-l-[3px] border-l-info bg-card px-3 py-2 text-[12px] leading-4 text-muted-foreground"
        role="note"
      >
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-info">
          Planning draft
        </span>
        {" · "}
        Requires technical and procurement review. This workspace does not produce a legally
        complete tender.
      </p>

      <section
        aria-labelledby="work-packages-heading"
        className="mx-4 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card"
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-border px-3">
          <h2
            className="m-0 font-mono text-[11px] font-medium tracking-[0.14em] text-foreground"
            id="work-packages-heading"
          >
            {view === "queue" ? "CREATION QUEUE" : "DRAFTS"}
          </h2>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {view === "queue"
              ? `${String(response.eligibleInterventions.length)} candidates`
              : `${String(response.data.length)} packages`}
          </p>
        </header>
        <WorkPackageTabs
          draftCount={response.data.length}
          queueCount={response.eligibleInterventions.length}
          view={view}
        />
        {view === "queue" ? (
          <EligibleInterventionsTable
            interventions={response.eligibleInterventions}
          />
        ) : (
          <WorkPackageDraftTable packages={response.data} />
        )}
      </section>
    </div>
  );
}
