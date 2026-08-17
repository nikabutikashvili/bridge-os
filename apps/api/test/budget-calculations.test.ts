import type { BudgetItem } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import {
  orderBudgetItems,
  summarizeBudget
} from "../src/features/budget/calculations.js";

describe("budget calculations", () => {
  it("aggregates decimal costs exactly", () => {
    const summary = summarizeBudget(
      [item("a", "HIGH", "0.10"), item("b", "MEDIUM", "0.20")],
      { amount: "1.00", currency: "EUR" }
    );

    expect(summary.selectedProgramValue.amount).toBe("0.30");
    expect(summary.remainingBudget?.amount).toBe("0.70");
    expect(summary.fundedInterventions).toBe(2);
  });

  it("keeps missing estimates in the program without treating them as zero-cost funded work", () => {
    const summary = summarizeBudget(
      [item("known", "HIGH", "40.00"), item("missing", "MEDIUM", null)],
      { amount: "100.00", currency: "EUR" }
    );

    expect(summary).toMatchObject({
      selectedProgramValue: { amount: "40.00", currency: "EUR" },
      includedInterventions: 2,
      fundedInterventions: 1,
      missingEstimateCount: 1
    });
  });

  it("reports overflow and funds only the deterministic priority prefix", () => {
    const summary = summarizeBudget(
      [item("lower", "LOW", "50.00"), item("higher", "HIGH", "70.00")],
      { amount: "100.00", currency: "EUR" }
    );

    expect(summary.budgetStatus).toBe("OVER_BUDGET");
    expect(summary.overBudget?.amount).toBe("20.00");
    expect(summary.remainingBudget).toBeNull();
    expect(summary.fundedInterventions).toBe(1);
  });

  it("orders by explainable priority and then stable work scope", () => {
    const ordered = orderBudgetItems([
      item("low", "LOW", "1.00", "Z work"),
      item("high-z", "HIGH", "1.00", "Z work"),
      item("high-a", "HIGH", "1.00", "A work")
    ]);

    expect(ordered.map((entry) => entry.intervention.id)).toEqual([
      uuid("high-a"),
      uuid("high-z"),
      uuid("low")
    ]);
  });

  it("breaks equal priority by network band then extra vehicle-km", () => {
    const ordered = orderBudgetItems([
      item("low-volume", "HIGH", "1.00", "Concrete repair", {
        band: "MEDIUM",
        extraVehicleKmPerDay: 100_000
      }),
      item("valley", "HIGH", "1.00", "Concrete repair", {
        band: "HIGH",
        extraVehicleKmPerDay: 1_500_000
      }),
      item("urban", "HIGH", "1.00", "Concrete repair", {
        band: "HIGH",
        extraVehicleKmPerDay: 2_000_000
      })
    ]);

    expect(ordered.map((entry) => entry.intervention.id)).toEqual([
      uuid("urban"),
      uuid("valley"),
      uuid("low-volume")
    ]);
  });
});

function item(
  key: string,
  level: BudgetItem["priority"]["level"],
  amount: string | null,
  workType = "Concrete repair",
  networkCriticality: BudgetItem["networkCriticality"] = null
): BudgetItem {
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
      workType,
      plannedYear: 2026,
      status: "PLANNED",
      estimatedCost:
        amount === null ? null : { amount, currency: "EUR" },
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
    included: true,
    networkCriticality,
    priority: {
      level,
      policyVersion: "maintenance-priority-v1",
      reasons: []
    }
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
