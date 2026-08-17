import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresBudgetScenarioService } from "../src/features/budget/postgres-budget-scenario-service.js";
import { PostgresBudgetService } from "../src/features/budget/postgres-budget-service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const pavementId = "44058840-0000-4000-8000-000000000703";
const concreteId = "44058840-0000-4000-8000-000000000701";

describeDatabase("PostgresBudgetScenarioService", () => {
  let connection: DatabaseConnection;
  let service: PostgresBudgetScenarioService;
  let budgetService: PostgresBudgetService;
  const createdIds: string[] = [];

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    service = new PostgresBudgetScenarioService(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
    budgetService = new PostgresBudgetService(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await service.remove(id);
    }
    await connection.close();
  });

  it("seeds assignments from live planned years and keeps the live programme untouched", async () => {
    const created = await service.create({
      name: "€5m sandbox",
      horizonStartYear: 2026,
      annualEnvelope: { amount: "5000000.00", currency: "EUR" }
    });
    createdIds.push(created.scenario.id);

    const pavement = created.data.find(
      (item) => item.intervention.id === pavementId
    );
    const concrete = created.data.find(
      (item) => item.intervention.id === concreteId
    );
    expect(pavement).toMatchObject({
      assignedYear: 2026,
      assignmentSource: "SEEDED",
      liveIncluded: true
    });
    expect(concrete).toMatchObject({
      assignedYear: 2027,
      assignmentSource: "SEEDED",
      liveIncluded: false
    });
    expect(created.yearSummaries[0]?.envelope).toEqual({
      amount: "5000000.00",
      currency: "EUR"
    });

    const live = await budgetService.get({ year: 2026 });
    expect(live.program.approvedBudget).toEqual({
      amount: "45000.00",
      currency: "EUR"
    });
  });

  it("auto-fills later years when the preferred year is too small", async () => {
    const created = await service.create({
      name: "Tight year-1",
      horizonStartYear: 2026,
      annualEnvelope: null
    });
    createdIds.push(created.scenario.id);

    const envelopes = await service.update(created.scenario.id, {
      envelopes: [
        {
          year: 2026,
          approvedBudget: { amount: "10000.00", currency: "EUR" }
        },
        {
          year: 2027,
          approvedBudget: { amount: "50000.00", currency: "EUR" }
        },
        { year: 2028, approvedBudget: null },
        { year: 2029, approvedBudget: null },
        { year: 2030, approvedBudget: null }
      ]
    });
    expect(envelopes.outcome).toBe("UPDATED");

    const filled = await service.autoFill(created.scenario.id, {
      preserveOverrides: true
    });
    expect(filled.outcome).toBe("UPDATED");
    if (filled.outcome !== "UPDATED") {
      return;
    }

    const pavement = filled.response.data.find(
      (item) => item.intervention.id === pavementId
    );
    expect(pavement?.assignedYear).toBe(2027);
    expect(pavement?.assignmentSource).toBe("AUTO_FILL");
    expect(filled.response.unassigned.missingEstimateCount).toBeGreaterThan(0);
  });

  it("records a user override without writing planned years", async () => {
    const created = await service.create({
      name: "Override",
      horizonStartYear: 2026,
      annualEnvelope: null
    });
    createdIds.push(created.scenario.id);

    const updated = await service.updateAssignment(
      created.scenario.id,
      concreteId,
      { assignedYear: 2026 }
    );
    expect(updated.outcome).toBe("UPDATED");
    if (updated.outcome !== "UPDATED") {
      return;
    }
    const concrete = updated.response.data.find(
      (item) => item.intervention.id === concreteId
    );
    expect(concrete).toMatchObject({
      assignedYear: 2026,
      assignmentSource: "USER_OVERRIDE",
      intervention: { plannedYear: 2027 }
    });
  });

  it("compares two independently allocated drafts", async () => {
    const left = await service.create({
      name: "Left",
      horizonStartYear: 2026,
      annualEnvelope: { amount: "10000.00", currency: "EUR" }
    });
    const right = await service.create({
      name: "Right",
      horizonStartYear: 2026,
      annualEnvelope: { amount: "40000.00", currency: "EUR" }
    });
    createdIds.push(left.scenario.id, right.scenario.id);

    const compared = await service.compare(left.scenario.id, right.scenario.id);
    expect(compared.outcome).toBe("COMPARED");
    if (compared.outcome !== "COMPARED") {
      return;
    }
    expect(compared.response.left.scenario.name).toBe("Left");
    expect(compared.response.right.scenario.name).toBe("Right");
    expect(compared.response.left.envelopes[0]?.approvedBudget?.amount).toBe(
      "10000.00"
    );
    expect(compared.response.right.envelopes[0]?.approvedBudget?.amount).toBe(
      "40000.00"
    );
  });
});
