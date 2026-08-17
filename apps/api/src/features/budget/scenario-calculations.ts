import type {
  BudgetItem,
  BudgetScenarioAssignmentSource,
  BudgetScenarioItem,
  BudgetScenarioResponse
} from "@bridge-os/contracts";
import type { PlanningPriorityLevel } from "@bridge-os/contracts";

import { money, orderBudgetItems, summarizeBudget, toMinorUnits } from "./calculations.js";

const priorityOrder: Record<PlanningPriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function horizonYearList(startYear: number, horizonYears: number): number[] {
  return Array.from({ length: horizonYears }, (_, index) => startYear + index);
}

export function yearInHorizon(
  year: number | null,
  years: readonly number[]
): year is number {
  return year !== null && years.includes(year);
}

export interface AutoFillCandidate {
  readonly interventionId: string;
  readonly workType: string;
  readonly plannedYear: number;
  readonly priorityLevel: PlanningPriorityLevel;
  readonly estimateMinorUnits: bigint | null;
  readonly assignedYear: number | null;
  readonly assignmentSource: BudgetScenarioAssignmentSource | null;
}

export interface AutoFillEnvelope {
  readonly year: number;
  readonly budgetMinorUnits: bigint | null;
}

export interface AutoFillAssignment {
  readonly interventionId: string;
  readonly assignedYear: number | null;
  readonly assignmentSource: BudgetScenarioAssignmentSource;
}

export function autoFillScenario(input: {
  readonly candidates: readonly AutoFillCandidate[];
  readonly years: readonly number[];
  readonly envelopes: readonly AutoFillEnvelope[];
  readonly preserveOverrides: boolean;
}): AutoFillAssignment[] {
  const remaining = new Map<number, bigint | null>();
  for (const year of input.years) {
    remaining.set(
      year,
      input.envelopes.find((envelope) => envelope.year === year)?.budgetMinorUnits ??
        null
    );
  }

  const ordered = [...input.candidates].sort((left, right) => {
    const priorityDifference =
      priorityOrder[right.priorityLevel] - priorityOrder[left.priorityLevel];
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    return (
      left.workType.localeCompare(right.workType) ||
      left.interventionId.localeCompare(right.interventionId)
    );
  });

  const locked = new Set<string>();
  const result = new Map<string, AutoFillAssignment>();

  if (input.preserveOverrides) {
    for (const candidate of ordered) {
      if (
        candidate.assignmentSource !== "USER_OVERRIDE" ||
        !yearInHorizon(candidate.assignedYear, input.years)
      ) {
        continue;
      }
      consumeCapacity(remaining, candidate.assignedYear, candidate.estimateMinorUnits);
      locked.add(candidate.interventionId);
      result.set(candidate.interventionId, {
        interventionId: candidate.interventionId,
        assignedYear: candidate.assignedYear,
        assignmentSource: "USER_OVERRIDE"
      });
    }
  }

  for (const candidate of ordered) {
    if (locked.has(candidate.interventionId)) {
      continue;
    }
    if (candidate.estimateMinorUnits === null) {
      result.set(candidate.interventionId, {
        interventionId: candidate.interventionId,
        assignedYear: null,
        assignmentSource: "AUTO_FILL"
      });
      continue;
    }

    const preferred = preferredYear(candidate, input.years);
    const assignedYear = firstFittingYear(
      input.years,
      preferred,
      remaining,
      candidate.estimateMinorUnits
    );
    if (assignedYear !== null) {
      consumeCapacity(remaining, assignedYear, candidate.estimateMinorUnits);
    }
    result.set(candidate.interventionId, {
      interventionId: candidate.interventionId,
      assignedYear,
      assignmentSource: "AUTO_FILL"
    });
  }

  return ordered.map((candidate) => {
    const assignment = result.get(candidate.interventionId);
    if (assignment === undefined) {
      throw new Error(`Auto-fill missed intervention ${candidate.interventionId}.`);
    }
    return assignment;
  });
}

export function scenarioItemsForYear(
  items: readonly BudgetScenarioItem[],
  year: number
): BudgetItem[] {
  return orderBudgetItems(
    items.map((item) => ({
      ...toBudgetItem(item),
      included: item.assignedYear === year
    }))
  );
}

export function summarizeUnassigned(
  items: readonly BudgetScenarioItem[],
  currency: string
): BudgetScenarioResponse["unassigned"] {
  const unassigned = items.filter((item) => item.assignedYear === null);
  const costed = unassigned.filter(
    (item): item is BudgetScenarioItem & { estimate: NonNullable<BudgetScenarioItem["estimate"]> } =>
      item.estimate !== null
  );
  for (const item of costed) {
    if (item.estimate.currency !== currency) {
      throw new Error(
        `Cannot aggregate ${item.estimate.currency} estimate into ${currency} backlog.`
      );
    }
  }
  const knownCost = costed.reduce(
    (sum, item) => sum + toMinorUnits(item.estimate.amount),
    0n
  );
  return {
    count: unassigned.length,
    knownCost: money(knownCost, currency),
    missingEstimateCount: unassigned.filter((item) => item.estimate === null).length
  };
}

export function summarizeScenarioYears(
  items: readonly BudgetScenarioItem[],
  years: readonly number[],
  envelopes: ReadonlyMap<number, BudgetScenarioResponse["envelopes"][number]["approvedBudget"]>
): BudgetScenarioResponse["yearSummaries"] {
  return years.map((year) => {
    const envelope = envelopes.get(year) ?? null;
    return {
      year,
      envelope,
      summary: summarizeBudget(scenarioItemsForYear(items, year), envelope)
    };
  });
}

export function listScenarioTotals(
  items: readonly BudgetScenarioItem[],
  envelopes: readonly BudgetScenarioResponse["envelopes"][number][],
  currency: string
): {
  assignedCount: number;
  unassignedCount: number;
  missingEstimateCount: number;
  programValue: ReturnType<typeof money>;
  envelopeTotal: ReturnType<typeof money> | null;
} {
  const assigned = items.filter((item) => item.assignedYear !== null);
  const costed = assigned.filter(
    (item): item is BudgetScenarioItem & { estimate: NonNullable<BudgetScenarioItem["estimate"]> } =>
      item.estimate !== null
  );
  for (const item of costed) {
    if (item.estimate.currency !== currency) {
      throw new Error(
        `Cannot aggregate ${item.estimate.currency} estimate into ${currency} scenario.`
      );
    }
  }
  const knownEnvelopes = envelopes.filter(
    (envelope): envelope is typeof envelope & { approvedBudget: NonNullable<typeof envelope.approvedBudget> } =>
      envelope.approvedBudget !== null
  );
  for (const envelope of knownEnvelopes) {
    if (envelope.approvedBudget.currency !== currency) {
      throw new Error("Cannot total envelopes with mixed currencies.");
    }
  }
  const envelopeMinorUnits = knownEnvelopes.reduce(
    (sum, envelope) => sum + toMinorUnits(envelope.approvedBudget.amount),
    0n
  );
  return {
    assignedCount: assigned.length,
    unassignedCount: items.length - assigned.length,
    missingEstimateCount: assigned.filter((item) => item.estimate === null).length,
    programValue: money(
      costed.reduce((sum, item) => sum + toMinorUnits(item.estimate.amount), 0n),
      currency
    ),
    envelopeTotal:
      knownEnvelopes.length === 0 ? null : money(envelopeMinorUnits, currency)
  };
}

function toBudgetItem(item: BudgetScenarioItem): BudgetItem {
  return {
    bridge: item.bridge,
    intervention: item.intervention,
    sourceRecommendation: item.sourceRecommendation,
    estimate: item.estimate,
    estimateRequired: item.estimateRequired,
    included: false,
    priority: item.priority
  };
}

function preferredYear(
  candidate: AutoFillCandidate,
  years: readonly number[]
): number {
  if (yearInHorizon(candidate.assignedYear, years)) {
    return candidate.assignedYear;
  }
  if (yearInHorizon(candidate.plannedYear, years)) {
    return candidate.plannedYear;
  }
  const first = years[0];
  if (first === undefined) {
    throw new Error("Auto-fill requires a non-empty horizon.");
  }
  return first;
}

function firstFittingYear(
  years: readonly number[],
  preferred: number,
  remaining: ReadonlyMap<number, bigint | null>,
  cost: bigint
): number | null {
  const start = years.indexOf(preferred);
  const sequence = start === -1 ? years : years.slice(start);
  for (const year of sequence) {
    const capacity = remaining.get(year);
    if (capacity === undefined || capacity === null) {
      continue;
    }
    if (capacity >= cost) {
      return year;
    }
  }
  return null;
}

function consumeCapacity(
  remaining: Map<number, bigint | null>,
  year: number,
  cost: bigint | null
): void {
  if (cost === null) {
    return;
  }
  const capacity = remaining.get(year);
  if (capacity === undefined || capacity === null) {
    return;
  }
  remaining.set(year, capacity - cost);
}
