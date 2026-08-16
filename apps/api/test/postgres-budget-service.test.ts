import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresBudgetService } from "../src/features/budget/postgres-budget-service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;

describeDatabase("PostgresBudgetService", () => {
  let connection: DatabaseConnection;
  let service: PostgresBudgetService;

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    service = new PostgresBudgetService(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    await connection.close();
  });

  it("keeps planning, source, and missing estimates distinct", async () => {
    const result = await service.get({ year: 2026 });

    expect(result.program.approvedBudget).toEqual({
      amount: "45000.00",
      currency: "EUR"
    });
    expect(result.summary).toMatchObject({
      selectedProgramValue: { amount: "28000.00", currency: "EUR" },
      remainingBudget: { amount: "17000.00", currency: "EUR" },
      includedInterventions: 2,
      fundedInterventions: 1,
      missingEstimateCount: 1,
      budgetStatus: "WITHIN_BUDGET"
    });

    const pavement = result.data.find(
      (item) => item.intervention.id === "44058840-0000-4000-8000-000000000703"
    );
    expect(pavement).toMatchObject({
      estimate: {
        amount: "28000.00",
        source: "USER_PLANNING",
        status: "DRAFT"
      },
      sourceRecommendation: {
        sourceEstimatedCost: { amount: "24000.00", currency: "EUR" }
      }
    });

    const capJoint = result.data.find(
      (item) => item.intervention.id === "44058840-0000-4000-8000-000000000702"
    );
    expect(capJoint).toMatchObject({
      estimate: null,
      estimateRequired: true,
      included: true
    });
  });

  it("updates membership transactionally and rejects cross-year membership", async () => {
    const existing = await service.updateMembership(
      2026,
      "44058840-0000-4000-8000-000000000703",
      { included: true }
    );
    expect(existing.outcome).toBe("UPDATED");

    const mismatch = await service.updateMembership(
      2026,
      "44058840-0000-4000-8000-000000000701",
      { included: true }
    );
    expect(mismatch).toEqual({
      outcome: "INTERVENTION_YEAR_MISMATCH",
      interventionId: "44058840-0000-4000-8000-000000000701",
      interventionYear: 2027,
      requestedYear: 2026
    });
  });
});
