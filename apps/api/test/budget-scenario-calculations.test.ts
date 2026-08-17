import type { BudgetScenarioItem } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import { money, toMinorUnits } from "../src/features/budget/calculations.js";
import {
  autoFillScenario,
  horizonYearList,
  listScenarioTotals,
  summarizeUnassigned,
  type AutoFillCandidate
} from "../src/features/budget/scenario-calculations.js";

describe("scenario calculations", () => {
  it("builds a contiguous five-year horizon", () => {
    expect(horizonYearList(2026, 5)).toEqual([2026, 2027, 2028, 2029, 2030]);
  });

  it("fills by priority into later years when the preferred year is full", () => {
    const assignments = autoFillScenario({
      candidates: [
        candidate("critical", "CRITICAL", "70.00", 2026),
        candidate("high", "HIGH", "40.00", 2026),
        candidate("medium", "MEDIUM", "20.00", 2026)
      ],
      envelopes: [
        { year: 2026, budgetMinorUnits: toMinorUnits("100.00") },
        { year: 2027, budgetMinorUnits: toMinorUnits("100.00") }
      ],
      preserveOverrides: true,
      years: [2026, 2027]
    });

    expect(assignments).toEqual([
      {
        interventionId: uuid("critical"),
        assignedYear: 2026,
        assignmentSource: "AUTO_FILL"
      },
      {
        interventionId: uuid("high"),
        assignedYear: 2027,
        assignmentSource: "AUTO_FILL"
      },
      {
        interventionId: uuid("medium"),
        assignedYear: 2026,
        assignmentSource: "AUTO_FILL"
      }
    ]);
  });

  it("leaves work unassigned when no later year has capacity", () => {
    const assignments = autoFillScenario({
      candidates: [
        candidate("first", "HIGH", "80.00", 2026),
        candidate("second", "MEDIUM", "80.00", 2026)
      ],
      envelopes: [{ year: 2026, budgetMinorUnits: toMinorUnits("100.00") }],
      preserveOverrides: true,
      years: [2026]
    });

    expect(assignments.map((row) => row.assignedYear)).toEqual([2026, null]);
  });

  it("does not consume capacity for missing estimates", () => {
    const assignments = autoFillScenario({
      candidates: [
        candidate("known", "HIGH", "40.00", 2026),
        candidate("missing", "CRITICAL", null, 2026)
      ],
      envelopes: [{ year: 2026, budgetMinorUnits: toMinorUnits("40.00") }],
      preserveOverrides: true,
      years: [2026]
    });

    expect(assignments).toEqual([
      {
        interventionId: uuid("missing"),
        assignedYear: null,
        assignmentSource: "AUTO_FILL"
      },
      {
        interventionId: uuid("known"),
        assignedYear: 2026,
        assignmentSource: "AUTO_FILL"
      }
    ]);
  });

  it("keeps user overrides and subtracts them from remaining capacity first", () => {
    const assignments = autoFillScenario({
      candidates: [
        candidate("override", "LOW", "60.00", 2026, 2026, "USER_OVERRIDE"),
        candidate("auto", "CRITICAL", "50.00", 2026)
      ],
      envelopes: [
        { year: 2026, budgetMinorUnits: toMinorUnits("100.00") },
        { year: 2027, budgetMinorUnits: toMinorUnits("100.00") }
      ],
      preserveOverrides: true,
      years: [2026, 2027]
    });

    expect(assignments).toEqual([
      {
        interventionId: uuid("auto"),
        assignedYear: 2027,
        assignmentSource: "AUTO_FILL"
      },
      {
        interventionId: uuid("override"),
        assignedYear: 2026,
        assignmentSource: "USER_OVERRIDE"
      }
    ]);
  });

  it("does not auto-fill into a year without an envelope", () => {
    const assignments = autoFillScenario({
      candidates: [candidate("large", "HIGH", "900.00", 2026)],
      envelopes: [{ year: 2026, budgetMinorUnits: null }],
      preserveOverrides: true,
      years: [2026]
    });

    expect(assignments[0]?.assignedYear).toBeNull();
  });

  it("summarises unassigned known cost without treating missing estimates as zero", () => {
    const summary = summarizeUnassigned(
      [scenarioItem("known", "40.00", null), scenarioItem("missing", null, null)],
      "EUR"
    );

    expect(summary).toEqual({
      count: 2,
      knownCost: money(4000n, "EUR"),
      missingEstimateCount: 1
    });
  });

  it("totals assigned programme value across the horizon", () => {
    const totals = listScenarioTotals(
      [
        scenarioItem("a", "10.00", 2026),
        scenarioItem("b", "15.00", 2027),
        scenarioItem("c", "20.00", null)
      ],
      [
        { year: 2026, approvedBudget: { amount: "50.00", currency: "EUR" } },
        { year: 2027, approvedBudget: { amount: "50.00", currency: "EUR" } }
      ],
      "EUR"
    );

    expect(totals).toEqual({
      assignedCount: 2,
      unassignedCount: 1,
      missingEstimateCount: 0,
      programValue: { amount: "25.00", currency: "EUR" },
      envelopeTotal: { amount: "100.00", currency: "EUR" }
    });
  });
});

function candidate(
  key: string,
  priorityLevel: AutoFillCandidate["priorityLevel"],
  amount: string | null,
  plannedYear: number,
  assignedYear: number | null = plannedYear,
  assignmentSource: AutoFillCandidate["assignmentSource"] = "SEEDED"
): AutoFillCandidate {
  return {
    interventionId: uuid(key),
    workType: key,
    plannedYear,
    priorityLevel,
    estimateMinorUnits: amount === null ? null : toMinorUnits(amount),
    assignedYear,
    assignmentSource
  };
}

function scenarioItem(
  key: string,
  amount: string | null,
  assignedYear: number | null
): BudgetScenarioItem {
  const id = uuid(key);
  return {
    bridge: {
      id: "00000000-0000-4000-8000-000000000099",
      externalStructureNumber: "4405884",
      name: "Heideckhofweg",
      road: "A57"
    },
    intervention: {
      id,
      workType: key,
      plannedYear: 2026,
      status: "PLANNED",
      estimatedCost: amount === null ? null : { amount, currency: "EUR" },
      estimatedCostSource: amount === null ? null : "USER_PLANNING",
      estimatedCostStatus: amount === null ? null : "DRAFT"
    },
    sourceRecommendation: {
      id: "00000000-0000-4000-8000-000000000098",
      urgency: "MITTELFRISTIG",
      targetYear: 2026,
      sourceEstimatedCost: null,
      sourceDate: null,
      inflationAdjustedEstimate: null
    },
    estimate:
      amount === null
        ? null
        : {
            amount,
            currency: "EUR",
            source: "USER_PLANNING",
            status: "DRAFT"
          },
    estimateRequired: amount === null,
    priority: {
      level: "MEDIUM",
      policyVersion: "maintenance-priority-v1",
      reasons: []
    },
    assignedYear,
    assignmentSource: assignedYear === null ? "AUTO_FILL" : "SEEDED",
    liveIncluded: false
  };
}

function uuid(key: string): string {
  let sum = 0;
  for (let index = 0; index < key.length; index += 1) {
    sum += key.charCodeAt(index);
  }
  const hex = sum.toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${hex}`;
}
