"use client";

import type {
  BudgetScenarioListResponse,
  BudgetScenarioResponse
} from "@bridge-os/contracts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { budgetCompareHref, budgetScenariosHref } from "./budget-query";
import { ScenarioCreateButton } from "./scenario-create-button";

interface ScenarioToolbarProps {
  readonly defaultYear: number;
  readonly list: BudgetScenarioListResponse["data"];
  readonly scenario: BudgetScenarioResponse["scenario"] | null;
}

export function ScenarioToolbar({
  defaultYear,
  list,
  scenario
}: ScenarioToolbarProps): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const compareCandidates = list.filter((item) => item.id !== scenario?.id);
  const selectedId = scenario?.id ?? list[0]?.id;

  function mutate(path: string, init: RequestInit, onDone?: () => void): void {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(path, init);
        if (!response.ok) throw await responseError(response);
        onDone?.();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Update failed.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedId !== undefined ? (
        <Select
          onValueChange={(value) => router.push(budgetScenariosHref(value))}
          value={selectedId}
        >
          <SelectTrigger aria-label="Budget scenario" className="w-[14rem]">
            <SelectValue placeholder="Select scenario" />
          </SelectTrigger>
          <SelectContent>
            {list.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <ScenarioCreateButton defaultYear={defaultYear} />
      {scenario !== null && compareCandidates.length > 0 ? (
        <Select
          onValueChange={(value) =>
            router.push(budgetCompareHref(scenario.id, value))
          }
        >
          <SelectTrigger aria-label="Compare with scenario" className="w-[11rem]">
            <SelectValue placeholder="Compare with" />
          </SelectTrigger>
          <SelectContent>
            {compareCandidates.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {scenario !== null ? (
        <>
          <Button
            disabled={isPending}
            onClick={() =>
              mutate(`/api/budget/scenarios/${scenario.id}/auto-fill`, {
                body: JSON.stringify({ preserveOverrides: true }),
                headers: { "content-type": "application/json" },
                method: "POST"
              })
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Fit to envelopes
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending} size="sm" type="button">
                Adopt
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Adopt this scenario?</AlertDialogTitle>
                <AlertDialogDescription>
                  This writes assigned years and envelopes into the live budget
                  programme. Draft exploration until now stays in this scenario
                  record.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() =>
                    mutate(`/api/budget/scenarios/${scenario.id}/adopt`, {
                      method: "POST"
                    })
                  }
                >
                  Adopt into live programme
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            disabled={isPending}
            onClick={() =>
              mutate(
                `/api/budget/scenarios/${scenario.id}`,
                { method: "DELETE" },
                () => router.push(budgetScenariosHref())
              )
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            Delete
          </Button>
        </>
      ) : null}
      {error ? (
        <span className="text-[11px] text-critical" role="alert">
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
