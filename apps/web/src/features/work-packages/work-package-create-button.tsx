"use client";

import { createWorkPackageResponseSchema } from "@bridge-os/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

interface WorkPackageCreateButtonProps {
  readonly interventionId: string;
  readonly workType: string;
}

export function WorkPackageCreateButton({
  interventionId,
  workType
}: WorkPackageCreateButtonProps): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(): void {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/work-packages", {
          body: JSON.stringify({ plannedInterventionId: interventionId }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!response.ok) throw await responseError(response);
        const created = createWorkPackageResponseSchema.parse(
          await response.json()
        );
        router.push(`/work-packages/${created.data.id}`);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to create draft."
        );
      }
    });
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        aria-label={`Create work package for ${workType}`}
        disabled={isPending}
        onClick={create}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? "Creating…" : "Create"}
      </Button>
      {error ? (
        <span className="text-[10px] leading-[14px] text-critical" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new Error(
    payload?.error?.message ?? `Request failed (${String(response.status)}).`
  );
}
