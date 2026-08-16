"use client";

import { RotateCw } from "lucide-react";

import { Button } from "../../src/components/ui/button";
import { ErrorState } from "../../src/components/ui/feedback";

export default function DocumentsError({
  reset
}: {
  readonly reset: () => void;
}): React.ReactElement {
  return (
    <div className="px-4 py-4">
      <ErrorState
        action={
          <Button onClick={reset} type="button" variant="outline">
            <RotateCw aria-hidden="true" size={14} />
            Try again
          </Button>
        }
        description="The document overview API could not provide a valid processing and data-quality view. Check the API and database connection, then retry."
      />
    </div>
  );
}
