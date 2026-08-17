"use client";

import {
  budgetScenarioResponseSchema
} from "@bridge-os/contracts";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { budgetScenariosHref } from "./budget-query";

interface ScenarioCreateButtonProps {
  readonly defaultYear: number;
}

export function ScenarioCreateButton({
  defaultYear
}: ScenarioCreateButtonProps): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(defaultYear));
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    const horizonStartYear = Number(year);
    if (!Number.isInteger(horizonStartYear)) {
      setError("Enter a valid start year.");
      return;
    }
    const normalized = normalizeAmount(amount);
    if (normalized === undefined) {
      setError("Enter a non-negative annual envelope, or leave it empty.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/budget/scenarios", {
          body: JSON.stringify({
            name: name.trim(),
            horizonStartYear,
            annualEnvelope:
              normalized === null ? null : { amount: normalized, currency: "EUR" }
          }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!response.ok) throw await responseError(response);
        const created = budgetScenarioResponseSchema.parse(await response.json());
        setOpen(false);
        setName("");
        setAmount("");
        router.push(budgetScenariosHref(created.scenario.id));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to create scenario.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          New scenario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create budget scenario</DialogTitle>
            <DialogDescription>
              A five-year sandbox. The live programme stays unchanged until you
              adopt this scenario.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="scenario-name">Name</Label>
              <Input
                id="scenario-name"
                onChange={(event) => setName(event.target.value)}
                placeholder="€5m / year"
                required
                value={name}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="scenario-year">Horizon start</Label>
                <Input
                  id="scenario-year"
                  inputMode="numeric"
                  onChange={(event) => setYear(event.target.value)}
                  required
                  type="number"
                  value={year}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="scenario-envelope">Annual envelope</Label>
                <div className="flex h-7 items-center overflow-hidden border border-border-strong">
                  <input
                    className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 font-mono text-[13px] tabular-nums outline-none placeholder:text-muted-foreground"
                    id="scenario-envelope"
                    inputMode="decimal"
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Optional"
                    value={amount}
                  />
                  <span className="border-l border-border px-1.5 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
                    EUR
                  </span>
                </div>
              </div>
            </div>
            {error ? (
              <p className="m-0 text-[12px] text-critical" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button disabled={isPending} size="sm" type="submit">
              {isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
