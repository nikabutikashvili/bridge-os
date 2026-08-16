import {
  createDatabaseConnection,
  plannedInterventions,
  workPackages,
  type DatabaseConnection
} from "@bridge-os/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresWorkPackageService } from "../src/features/work-packages/postgres-work-package-service.js";

const databaseUrl = process.env["TEST_DATABASE_URL"];
const describeDatabase = databaseUrl === undefined ? describe.skip : describe;
const interventionId = "44058840-0000-4000-8000-000000000702";
const budgetedInterventionId = "44058840-0000-4000-8000-000000000703";

describeDatabase("PostgresWorkPackageService", () => {
  let connection: DatabaseConnection;
  let service: PostgresWorkPackageService;

  beforeAll(async () => {
    connection = createDatabaseConnection({ DATABASE_URL: databaseUrl });
    await removeTestPackage();
    await resetBudgetedIntervention();
    service = new PostgresWorkPackageService(
      connection.db,
      () => new Date("2026-08-15T12:00:00.000Z")
    );
  });

  afterAll(async () => {
    await removeTestPackage();
    await resetBudgetedIntervention();
    await connection.close();
  });

  it("creates and reads an immutable source-backed snapshot", async () => {
    const created = await service.create({ plannedInterventionId: interventionId });
    expect(created.outcome).toBe("CREATED");
    if (created.outcome !== "CREATED") return;

    expect(created.response.data.snapshot).toMatchObject({
      version: 1,
      asset: {
        bridge: {
          externalStructureNumber: "9999999",
          name: "Musterbrücke Fiktivtal",
          road: "A57"
        }
      },
      scope: {
        interventionId,
        workType: "Elastische Kappenfugenabdichtung",
        quantity: { value: "14.750", unit: "m" },
        components: [
          expect.objectContaining({ type: "KAPPEN", material: "Stahlbeton" })
        ],
        findings: [
          expect.objectContaining({
            sourceIdentifier: "DEMO-S-2023-003",
            ratings: { stability: 0, trafficSafety: 1, durability: 2 }
          })
        ]
      },
      commercialPlanning: {
        planningEstimate: null,
        estimateSource: null,
        sourceRecommendationEstimate: null
      },
      operationalContext: {
        trafficManagementRequirements: null,
        inspectionAccessEquipment: null,
        knownConstraints: []
      }
    });
    expect(created.response.data.snapshot.evidence.citations.length).toBeGreaterThan(0);
    expect(created.response.data.snapshot.readiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COST_ESTIMATE_AVAILABLE",
          state: "MISSING"
        }),
        expect.objectContaining({
          code: "SITE_VERIFICATION_REQUIRED",
          state: "REQUIRED"
        })
      ])
    );

    const read = await service.get(created.response.data.id);
    expect(read).toEqual(created.response);
  });

  it("returns the existing package instead of creating a second snapshot", async () => {
    const result = await service.create({ plannedInterventionId: interventionId });
    expect(result).toMatchObject({
      outcome: "WORK_PACKAGE_ALREADY_EXISTS",
      plannedInterventionId: interventionId
    });
  });

  it("removes packaged interventions from the creation queue", async () => {
    const list = await service.list();
    expect(
      list.data.some(
        (item) => item.title === "Elastische Kappenfugenabdichtung · 9999999"
      )
    ).toBe(true);
    expect(list.eligibleInterventions.some((item) => item.id === interventionId)).toBe(
      false
    );
  });

  it("advances a budgeted intervention to tender preparation when a work package is created", async () => {
    const before = await interventionStatus(budgetedInterventionId);
    expect(before).toBe("BUDGETED");

    const created = await service.create({
      plannedInterventionId: budgetedInterventionId
    });
    expect(created.outcome).toBe("CREATED");

    const after = await interventionStatus(budgetedInterventionId);
    expect(after).toBe("TENDER_PREPARATION");
  });

  it("reverts the intervention to budgeted when its work package is deleted", async () => {
    const [existing] = await connection.db
      .select({ id: workPackages.id })
      .from(workPackages)
      .where(eq(workPackages.plannedInterventionId, budgetedInterventionId))
      .limit(1);
    expect(existing).toBeDefined();
    if (existing === undefined) return;

    const removed = await service.remove(existing.id);
    expect(removed).toEqual({
      outcome: "DELETED",
      plannedInterventionId: budgetedInterventionId
    });

    const after = await interventionStatus(budgetedInterventionId);
    expect(after).toBe("BUDGETED");

    const remaining = await connection.db
      .select({ id: workPackages.id })
      .from(workPackages)
      .where(eq(workPackages.plannedInterventionId, budgetedInterventionId));
    expect(remaining).toHaveLength(0);
  });

  it("reports not-found when deleting a work package that does not exist", async () => {
    const removed = await service.remove(
      "00000000-0000-4000-8000-000000000000"
    );
    expect(removed).toEqual({
      outcome: "WORK_PACKAGE_NOT_FOUND",
      workPackageId: "00000000-0000-4000-8000-000000000000"
    });
  });

  async function removeTestPackage(): Promise<void> {
    await connection.db
      .delete(workPackages)
      .where(eq(workPackages.plannedInterventionId, interventionId));
  }

  async function resetBudgetedIntervention(): Promise<void> {
    await connection.db
      .delete(workPackages)
      .where(eq(workPackages.plannedInterventionId, budgetedInterventionId));
    await connection.db
      .update(plannedInterventions)
      .set({ status: "BUDGETED" })
      .where(eq(plannedInterventions.id, budgetedInterventionId));
  }

  async function interventionStatus(id: string): Promise<string | undefined> {
    const [row] = await connection.db
      .select({ status: plannedInterventions.status })
      .from(plannedInterventions)
      .where(eq(plannedInterventions.id, id))
      .limit(1);
    return row?.status;
  }
});
