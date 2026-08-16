"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface WorkPackageDeleteButtonProps {
  readonly workPackageId: string;
  readonly title: string;
}

export function WorkPackageDeleteButton({
  workPackageId,
  title
}: WorkPackageDeleteButtonProps): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(event: { preventDefault: () => void }): void {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/work-packages/${encodeURIComponent(workPackageId)}`,
          { method: "DELETE" }
        );
        if (!response.ok && response.status !== 204) {
          throw await responseError(response);
        }
        setOpen(false);
        router.push("/work-packages");
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to delete draft."
        );
      }
    });
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button
          aria-label={`Delete work package for ${title}`}
          disabled={isPending}
          size="sm"
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden="true" size={14} />
          {isPending ? "Deleting…" : "Delete draft"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this draft work package?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{title}&rdquo; will be removed and its intervention reverts out of tender
            preparation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="m-0 border-l-[3px] border-l-critical bg-critical-bg px-2.5 py-2 text-[12px] leading-4 text-critical" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={remove}>
            {isPending ? "Deleting…" : "Delete draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
