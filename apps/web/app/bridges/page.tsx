import type { Metadata } from "next";

import { getBridgePortfolio } from "../../src/features/bridges/api";
import { PortfolioFilters } from "../../src/features/bridges/portfolio-filters";
import {
  parsePortfolioSearchParams,
  type PortfolioSearchParams
} from "../../src/features/bridges/portfolio-query";
import { PortfolioSummary } from "../../src/features/bridges/portfolio-summary";
import { PortfolioTable } from "../../src/features/bridges/portfolio-table";
import { formatGermanDate } from "../../src/lib/formatters";

export const metadata: Metadata = { title: "Portfolio monitoring" };

interface PortfolioPageProps {
  readonly searchParams: Promise<PortfolioSearchParams>;
}

export default async function PortfolioPage({
  searchParams
}: PortfolioPageProps): Promise<React.ReactElement> {
  const query = parsePortfolioSearchParams(await searchParams);
  const portfolio = await getBridgePortfolio(query);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="m-0 font-mono text-[12px] font-medium tracking-[0.16em] text-chrome">
            OBJECT SET / BRIDGES
          </h1>
          <p className="m-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(portfolio.pagination.totalItems)} objects
          </p>
        </div>
        <p className="m-0 font-mono text-[10px] tracking-[0.12em] tabular-nums text-muted-foreground">
          AS OF {formatGermanDate(portfolio.asOf)}
        </p>
      </header>

      <PortfolioSummary summary={portfolio.summary} />

      <section
        aria-labelledby="inventory-heading"
        className="mx-4 mb-4 mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border-strong bg-card"
      >
        <header className="flex h-9 shrink-0 items-center justify-between gap-4 bg-chrome px-3 text-chrome-foreground">
          <h2
            className="m-0 font-mono text-[11px] font-medium tracking-[0.14em] text-chrome-foreground"
            id="inventory-heading"
          >
            STRUCTURES
          </h2>
          <p className="m-0 font-mono text-[11px] tabular-nums text-chrome-muted">
            {String(portfolio.pagination.totalItems)} matching
          </p>
        </header>
        <div className="shrink-0 border-b border-border px-3 py-2">
          <PortfolioFilters query={query} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <PortfolioTable
            pagination={portfolio.pagination}
            query={query}
            rows={portfolio.data}
          />
        </div>
      </section>
    </div>
  );
}
