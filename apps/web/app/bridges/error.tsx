"use client";

import { RotateCw } from "lucide-react";

import { Button } from "../../src/components/ui/button";
import { ErrorState } from "../../src/components/ui/feedback";

interface PortfolioErrorProps {
  readonly reset: () => void;
}

export default function PortfolioError({
  reset
}: PortfolioErrorProps): React.ReactElement {
  return (
    <div className="p-4">
      <ErrorState
        action={
          <Button onClick={reset} type="button" variant="outline">
            <RotateCw aria-hidden="true" size={14} />
            Try again
          </Button>
        }
        description="The portfolio API could not provide a valid monitoring view. Check the API and database connection, then retry."
      />
    </div>
  );
}
