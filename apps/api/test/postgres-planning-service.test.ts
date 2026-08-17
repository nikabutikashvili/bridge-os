import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresPlanningService } from "../src/features/planning/postgres-planning-service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;

describeDatabase("PostgresPlanningService", () => {
  let connection: DatabaseConnection;
  let service: PostgresPlanningService;

  beforeAll(() => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    service = new PostgresPlanningService(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    await connection.close();
  });

  it("builds lifecycle counts without merging source recommendations into plans", async () => {
    const response = await service.list({
      page: 1,
      pageSize: 25,
      view: "recommended-unplanned"
    });

    expect(response.summary).toEqual({
      recommendedUnplanned: 2,
      planned: 1,
      budgeted: 1,
      tenderPreparation: 1,
      tenderedReady: 0,
      inProgress: 0,
      completed: 0
    });
    expect(response.data).toHaveLength(2);
    expect(response.data.every((item) => item.plannedIntervention === null)).toBe(
      true
    );
    expect(response.data[0]).toMatchObject({
      bridge: {
        externalStructureNumber: "9999999",
        name: "Musterbrücke Fiktivtal",
        road: "A57"
      },
      priority: { level: "HIGH", policyVersion: "maintenance-priority-v1" }
    });
    expect(response.data[0]?.priority.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining([
        "CONDITION_DETERIORATING",
        "MEDIUM_TERM_URGENCY",
        "LONG_UNRESOLVED",
        "HIGH_TRAFFIC",
        "HIGH_ENVIRONMENTAL_EXPOSURE"
      ])
    );
  });

  it("returns managerial scope and source scope as distinct objects", async () => {
    const response = await service.list({
      page: 1,
      pageSize: 25,
      view: "budgeted"
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      sourceRecommendation: {
        workType: "FAHRBAHNFUGENINSTANDSETZUNG",
        quantity: { value: "30.000", unit: "m" },
        sourceEstimatedCost: { amount: "24000.00", currency: "EUR" }
      },
      plannedIntervention: {
        workType: "Erneuerung der Fahrbahnanschlüsse",
        plannedYear: 2026,
        quantity: { value: "30.000", unit: "m" },
        estimatedCost: { amount: "28000.00", currency: "EUR" },
        status: "BUDGETED"
      }
    });
    expect(response.data[0]?.linkedFindings[0]).toMatchObject({
      sourceIdentifier: "DEMO-S-2023-004",
      ratings: { durability: 2, stability: 0, trafficSafety: 2 }
    });
  });

  it("reports an existing intervention without inserting a duplicate", async () => {
    const result = await service.createFromRecommendation({
      recommendationId: "44058840-0000-4000-8000-000000000403",
      workType: "Duplicate attempt",
      plannedYear: 2027
    });

    expect(result).toEqual({
      interventionId: "44058840-0000-4000-8000-000000000703",
      outcome: "INTERVENTION_ALREADY_EXISTS",
      recommendationId: "44058840-0000-4000-8000-000000000403"
    });
  });
});
