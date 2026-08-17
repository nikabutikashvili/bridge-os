"use client";

import type { BudgetScenarioResponse } from "@bridge-os/contracts";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatCurrency } from "../../lib/formatters";

interface ScenarioHorizonProps {
  readonly scenario: BudgetScenarioResponse;
}

export function ScenarioHorizon({
  scenario
}: ScenarioHorizonProps): React.ReactElement {
  const router = useRouter();
  const [amounts, setAmounts] = useState(envelopeState(scenario));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAmounts(envelopeState(scenario));
  }, [scenario]);

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const envelopes = scenario.scenario.years.map((year) => {
      const normalized = normalizeAmount(amounts[String(year)] ?? "");
      return { year, normalized };
    });
    if (envelopes.some((entry) => entry.normalized === undefined)) {
      setError("Enter non-negative amounts with at most two decimal places.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/budget/scenarios/${scenario.scenario.id}`,
          {
            body: JSON.stringify({
              envelopes: envelopes.map((entry) => ({
                year: entry.year,
                approvedBudget:
                  entry.normalized === null || entry.normalized === undefined
                    ? null
                    : { amount: entry.normalized, currency: scenario.scenario.currency }
              }))
            }),
            headers: { "content-type": "application/json" },
            method: "PATCH"
          }
        );
        if (!response.ok) throw await responseError(response);
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to save envelopes."
        );
      }
    });
  }

  return (
    <form className="grid shrink-0 gap-3 px-4 pt-4" onSubmit={submit}>
      <section
        aria-label="Scenario horizon"
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${String(scenario.scenario.years.length + 1)}, minmax(0, 1fr))` }}
      >
        {scenario.yearSummaries.map((year) => {
          const over = year.summary.budgetStatus === "OVER_BUDGET";
          return (
            <article
              className={cn(
                "grid min-w-0 gap-2 border border-border-strong bg-card px-3 py-3",
                over && "border-l-[3px] border-l-critical"
              )}
              key={year.year}
            >
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-chrome">
                {year.year}
              </span>
              <label className="grid gap-1">
                <span className="sr-only">Envelope {year.year}</span>
                <div className="flex h-7 items-center overflow-hidden border border-border-strong">
                  <input
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-[13px] tabular-nums outline-none placeholder:text-muted-foreground"
                    inputMode="decimal"
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [String(year.year)]: event.target.value
                      }))
                    }
                    placeholder="Not set"
                    value={amounts[String(year.year)] ?? ""}
                  />
                  <span className="border-l border-border px-1.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
                    EUR
                  </span>
                </div>
              </label>
              <p className="m-0 font-mono text-[16px] font-medium tabular-nums leading-none">
                {formatMoney(year.summary.selectedProgramValue)}
              </p>
              <p
                className={cn(
                  "m-0 text-[11px] leading-4 text-muted-foreground",
                  over && "text-critical"
                )}
              >
                {over
                  ? `Over ${formatMoney(year.summary.overBudget)}`
                  : year.summary.budgetStatus === "NOT_SET"
                    ? `${String(year.summary.includedInterventions)} assigned`
                    : `${formatMoney(year.summary.remainingBudget)} remaining`}
              </p>
            </article>
          );
        })}
        <article className="grid min-w-0 gap-2 border border-border-strong border-l-[3px] border-l-warning bg-card px-3 py-3">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-chrome">
            Unassigned
          </span>
          <p className="m-0 font-mono text-[22px] font-medium tabular-nums leading-none">
            {scenario.unassigned.count}
          </p>
          <p className="m-0 text-[11px] leading-4 text-muted-foreground">
            {formatMoney(scenario.unassigned.knownCost)} known
            {scenario.unassigned.missingEstimateCount > 0
              ? ` · ${String(scenario.unassigned.missingEstimateCount)} missing estimate`
              : ""}
          </p>
        </article>
      </section>
      <div className="flex items-center gap-2">
        <Button disabled={isPending} size="sm" type="submit" variant="outline">
          <Save aria-hidden="true" size={12} strokeWidth={1.6} />
          Save envelopes
        </Button>
        {error ? (
          <span className="text-[11px] text-critical" role="alert">
            {error}
          </span>
        ) : null}
        <p className="m-0 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
          {scenario.scenario.status === "ADOPTED" ? "ADOPTED · editing creates a new draft" : "DRAFT"}
        </p>
      </div>
    </form>
  );
}

function envelopeState(
  scenario: BudgetScenarioResponse
): Record<string, string> {
  return Object.fromEntries(
    scenario.envelopes.map((envelope) => [
      String(envelope.year),
      envelope.approvedBudget?.amount ?? ""
    ])
  );
}

function formatMoney(
  money: { amount: string; currency: string } | null
): string {
  return money === null ? "—" : formatCurrency(money.amount, money.currency);
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
