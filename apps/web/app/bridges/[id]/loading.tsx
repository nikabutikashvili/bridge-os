import { LoadingSkeleton } from "../../../src/components/ui/feedback";

export default function BridgeOverviewLoading(): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">
      <LoadingSkeleton label="Loading bridge identity" lines={3} />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="border border-border bg-card px-4 py-3" key={index}>
            <LoadingSkeleton lines={2} />
          </div>
        ))}
      </div>
      <LoadingSkeleton label="Loading bridge detail" lines={8} />
    </div>
  );
}
