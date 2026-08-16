import type { Metadata } from "next";

import { getDocumentOverview } from "../../src/features/documents/api";
import { DataHealthTable } from "../../src/features/documents/data-health-table";
import { DocumentRegister } from "../../src/features/documents/document-register";
import { DocumentSummary } from "../../src/features/documents/document-summary";
import { DocumentTabs } from "../../src/features/documents/document-tabs";
import { parseDocumentView } from "../../src/features/documents/document-query";
import { formatGermanDate } from "../../src/lib/formatters";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

interface DocumentsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DocumentsPage({
  searchParams
}: DocumentsPageProps): Promise<React.ReactElement> {
  const query = await searchParams;
  const view = parseDocumentView(query["view"]);
  const overview = await getDocumentOverview();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 font-mono text-[12px] font-medium tracking-[0.16em] text-foreground">
            OBJECT SET / DOCUMENTS
          </h1>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(overview.summary.totalDocuments)} records
          </p>
        </div>
        <p className="m-0 font-mono text-[10px] tracking-[0.12em] tabular-nums text-muted-foreground">
          AS OF {formatGermanDate(overview.asOf)}
        </p>
      </header>

      <DocumentSummary summary={overview.summary} />

      <section
        aria-labelledby="documents-heading"
        className="mx-4 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card"
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-border px-3">
          <h2
            className="m-0 font-mono text-[11px] font-medium tracking-[0.14em] text-foreground"
            id="documents-heading"
          >
            {view === "health" ? "DATA HEALTH" : "REGISTER"}
          </h2>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {view === "health"
              ? `${String(overview.bridgeDataHealth.length)} structures`
              : `${String(overview.documents.length)} records`}
          </p>
        </header>
        <DocumentTabs
          healthCount={overview.bridgeDataHealth.length}
          registerCount={overview.documents.length}
          view={view}
        />
        {view === "health" ? (
          <DataHealthTable bridges={overview.bridgeDataHealth} />
        ) : (
          <DocumentRegister documents={overview.documents} />
        )}
      </section>
    </div>
  );
}
