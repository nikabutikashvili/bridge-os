import type { BudgetItem, BudgetResponse } from "@bridge-os/contracts";

type Money = NonNullable<BudgetResponse["program"]["approvedBudget"]>;

const priorityOrder = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
} as const;

export function orderBudgetItems(items: readonly BudgetItem[]): BudgetItem[] {
  return [...items].sort((left, right) => {
    const priorityDifference =
      priorityOrder[right.priority.level] - priorityOrder[left.priority.level];
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return (
      left.intervention.workType.localeCompare(right.intervention.workType) ||
      left.intervention.id.localeCompare(right.intervention.id)
    );
  });
}

export function summarizeBudget(
  items: readonly BudgetItem[],
  approvedBudget: Money | null
): BudgetResponse["summary"] {
  const ordered = orderBudgetItems(items);
  const selected = ordered.filter((item) => item.included);
  const currency =
    approvedBudget?.currency ??
    selected.find((item) => item.estimate !== null)?.estimate?.currency ??
    "EUR";
  const costed = selected.filter(
    (item): item is BudgetItem & { estimate: NonNullable<BudgetItem["estimate"]> } =>
      item.estimate !== null
  );

  for (const item of costed) {
    if (item.estimate.currency !== currency) {
      throw new Error(
        `Cannot aggregate ${item.estimate.currency} estimate into ${currency} budget.`
      );
    }
  }

  const selectedMinorUnits = costed.reduce(
    (sum, item) => sum + toMinorUnits(item.estimate.amount),
    0n
  );
  const budgetMinorUnits =
    approvedBudget === null ? null : toMinorUnits(approvedBudget.amount);
  const difference =
    budgetMinorUnits === null ? null : budgetMinorUnits - selectedMinorUnits;

  return {
    selectedProgramValue: money(selectedMinorUnits, currency),
    remainingBudget:
      difference !== null && difference >= 0n ? money(difference, currency) : null,
    overBudget:
      difference !== null && difference < 0n ? money(-difference, currency) : null,
    includedInterventions: selected.length,
    fundedInterventions: countFunded(ordered, budgetMinorUnits, currency),
    missingEstimateCount: selected.filter((item) => item.estimate === null).length,
    budgetStatus:
      difference === null
        ? "NOT_SET"
        : difference < 0n
          ? "OVER_BUDGET"
          : "WITHIN_BUDGET"
  };
}

function countFunded(
  ordered: readonly BudgetItem[],
  budgetMinorUnits: bigint | null,
  currency: string
): number {
  if (budgetMinorUnits === null) {
    return 0;
  }
  let allocated = 0n;
  let funded = 0;
  for (const item of ordered) {
    if (!item.included || item.estimate === null) {
      continue;
    }
    if (item.estimate.currency !== currency) {
      throw new Error("Cannot rank estimates with mixed currencies.");
    }
    const next = allocated + toMinorUnits(item.estimate.amount);
    if (next > budgetMinorUnits) {
      break;
    }
    allocated = next;
    funded += 1;
  }
  return funded;
}

function toMinorUnits(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/u.exec(value);
  if (match?.[1] === undefined) {
    throw new RangeError(`Expected a non-negative amount with at most two decimals: ${value}`);
  }
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function money(amount: bigint, currency: string): Money {
  const whole = amount / 100n;
  const fraction = (amount % 100n).toString().padStart(2, "0");
  return { amount: `${String(whole)}.${fraction}`, currency };
}
