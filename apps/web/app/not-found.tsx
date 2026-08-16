import Link from "next/link";

import { EmptyState } from "../src/components/ui/feedback";

export default function NotFound(): React.ReactElement {
  return (
    <div className="p-4">
      <EmptyState
        action={
          <Link
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold text-foreground shadow-xs hover:bg-secondary"
            href="/"
          >
            Back to bridges
          </Link>
        }
        description="The page you are looking for does not exist or has been moved."
        title="Page not found"
      />
    </div>
  );
}
