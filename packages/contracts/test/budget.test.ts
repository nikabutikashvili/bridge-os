import {
  budgetResponseSchema,
  createBudgetScenarioSchema,
  updateBudgetSchema,
  updateBudgetMembershipSchema
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("budget API contracts", () => {
  it("requires decimal-string money and explicit membership", () => {
    expect(
      updateBudgetSchema.safeParse({
        approvedBudget: { amount: "50000.00", currency: "EUR" }
      }).success
    ).toBe(true);
    expect(
      updateBudgetSchema.safeParse({
        approvedBudget: { amount: 50000, currency: "EUR" }
      }).success
    ).toBe(false);
    expect(updateBudgetMembershipSchema.safeParse({ included: true }).success).toBe(
      true
    );
  });

  it("preserves effective estimate provenance in the read model", () => {
    const result = budgetResponseSchema.safeParse({
      asOf: "2026-08-15",
      availableYears: [2026],
      program: {
        id: null,
        planningYear: 2026,
        approvedBudget: null
      },
      data: [],
      summary: {
        selectedProgramValue: { amount: "0.00", currency: "EUR" },
        remainingBudget: null,
        overBudget: null,
        includedInterventions: 0,
        fundedInterventions: 0,
        missingEstimateCount: 0,
        budgetStatus: "NOT_SET"
      }
    });
    expect(result.success).toBe(true);
  });

  it("accepts a named scenario with an optional annual envelope", () => {
    expect(
      createBudgetScenarioSchema.safeParse({
        name: "€5m / year",
        horizonStartYear: 2026
      }).success
    ).toBe(true);
    expect(
      createBudgetScenarioSchema.safeParse({
        name: "€5m / year",
        horizonStartYear: 2026,
        annualEnvelope: { amount: "5000000.00", currency: "EUR" }
      }).success
    ).toBe(true);
  });
});
