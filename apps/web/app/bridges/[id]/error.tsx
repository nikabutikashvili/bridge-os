"use client";

import { RotateCw } from "lucide-react";

import { Button } from "../../../src/components/ui/button";
import { ErrorState } from "../../../src/components/ui/feedback";

export default function BridgeDetailError({
  reset
}: {
  readonly reset: () => void;
}): React.ReactElement {
  return (
    <ErrorState
      action={
        <Button onClick={reset} type="button" variant="outline">
          <RotateCw aria-hidden="true" size={14} />
          Try again
        </Button>
      }
      description="The bridge detail APIs could not provide a valid view. Check the API and database connection, then retry."
    />
  );
}
