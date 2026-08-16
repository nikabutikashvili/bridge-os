"use client";

import type { BudgetResponse } from "@bridge-os/contracts";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type SyntheticEvent,
  useEffect,
  useState,
  useTransition
} from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { budgetHref } from "./budget-query";

interface BudgetControlsProps {
  readonly availableYears: readonly number[];
  readonly approvedBudget: BudgetResponse["program"]["approvedBudget"];
  readonly planningYear: number;
}

export function BudgetControls({
  availableYears,
  approvedBudget,
  planningYear
}: BudgetControlsProps): React.ReactElement {
  const router = useRouter();
  const [amount, setAmount] = useState(approvedBudget?.amount ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAmount(approvedBudget?.amount ?? "");
  }, [approvedBudget?.amount, planningYear]);

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalized = normalizeAmount(amount);
    if (normalized === undefined) {
      setError("Enter a non-negative amount with at most two decimal places.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/budget/${String(planningYear)}`, {
          body: JSON.stringify({
            approvedBudget:
              normalized === null
                ? null
                : { amount: normalized, currency: "EUR" }
          }),
          headers: { "content-type": "application/json" },
          method: "PUT"
        });
        if (!response.ok) throw await responseError(response);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to update budget."
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        onValueChange={(value) => router.push(budgetHref(Number(value)))}
        value={String(planningYear)}
      >
        <SelectTrigger aria-label="Planning year" className="w-[5.75rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form className="relative flex items-center gap-1.5" onSubmit={submit}>
        <div className="flex h-7 items-center overflow-hidden border border-border-strong bg-transparent focus-within:border-foreground">
          <input
            aria-describedby={error ? "budget-input-error" : undefined}
            aria-label="Available budget"
            className="h-full w-[7.5rem] min-w-0 border-0 bg-transparent px-2 font-mono text-[13px] tabular-nums outline-none placeholder:text-muted-foreground"
            id="budget-amount"
            inputMode="decimal"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Not set"
            step="0.01"
            type="number"
            value={amount}
          />
          <span className="border-l border-border px-1.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            EUR
          </span>
        </div>
        <Button
          aria-label="Save available budget"
          disabled={isPending}
          size="sm"
          title="Save available budget"
          type="submit"
          variant="outline"
        >
          <Save aria-hidden="true" size={12} strokeWidth={1.6} />
          Save
        </Button>
        {error ? (
          <span
            className="absolute right-0 top-full z-10 mt-1 w-[230px] border border-critical-border border-l-[3px] border-l-critical bg-critical-bg px-2 py-1 text-[11px] leading-4 text-critical"
            id="budget-input-error"
            role="alert"
          >
            {error}
          </span>
        ) : null}
      </form>
    </div>
  );
}

function normalizeAmount(value: string): string | null | undefined {
  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0) return null;
  const match = /^(?:0|[1-9]\d*)(?:\.(\d{1,2}))?$/u.exec(normalized);
  if (match === null) return undefined;
  const fractionLength = match[1]?.length ?? 0;
  return normalized.includes(".")
    ? `${normalized}${"0".repeat(2 - fractionLength)}`
    : `${normalized}.00`;
}

async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new Error(
    payload?.error?.message ?? `Request failed (${String(response.status)}).`
  );
}
