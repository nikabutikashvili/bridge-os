import { Skeleton } from "../../src/components/ui/skeleton";

export default function PortfolioLoading(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-9 items-center px-4">
        <Skeleton className="h-3 w-40" />
      </header>
      <div
        aria-label="Loading portfolio metrics"
        className="grid grid-cols-4 gap-3 px-4 pt-4"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div className="border border-border bg-card px-4 py-3" key={index}>
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="mb-2 h-8 w-12" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 mt-4 min-h-0 flex-1 border border-border bg-card p-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton className="mb-2 h-6 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}
