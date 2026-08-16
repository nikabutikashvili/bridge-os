import { LoadingSkeleton } from "../../src/components/ui/feedback";

export default function BudgetLoading(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
      <LoadingSkeleton label="Loading budget identity" lines={1} />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="border border-border bg-card px-4 py-3" key={index}>
            <LoadingSkeleton lines={2} />
          </div>
        ))}
      </div>
      <div className="mt-4 min-h-0 flex-1 border border-border bg-card px-3 py-3">
        <LoadingSkeleton label="Loading budget program" lines={7} />
      </div>
    </div>
  );
}
