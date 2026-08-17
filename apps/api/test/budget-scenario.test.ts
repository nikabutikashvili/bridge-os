import type {
  BudgetScenarioListResponse,
  BudgetScenarioResponse,
  CreateBudgetScenario
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { BudgetScenarioService } from "../src/features/budget/budget-scenario-service.js";
import type { BudgetService } from "../src/features/budget/budget-service.js";

const scenarioId = "44058840-0000-4000-8000-000000000901";
const otherScenarioId = "44058840-0000-4000-8000-000000000902";
const testEnv = {
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
  DOCUMENT_MAX_UPLOAD_BYTES: 25 * 1_024 * 1_024,
  DOCUMENT_STORAGE_ROOT: ".data/test-documents",
  LOG_LEVEL: "silent",
  NODE_ENV: "test"
} as const;

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("budget scenario routes", () => {
  it("creates a named draft scenario", async () => {
    let observed: CreateBudgetScenario | undefined;
    app = buildApp({
      budgetScenarioService: scenarioService({
        create: (input) => {
          observed = input;
          return Promise.resolve(scenarioResponse(scenarioId, input.name));
        }
      }),
      budgetService: unusedBudgetService(),
      env: testEnv
    });

    const result = await app.inject({
      method: "POST",
      url: "/api/v1/budget/scenarios",
      payload: {
        name: "€5m / year",
        horizonStartYear: 2026,
        annualEnvelope: { amount: "5000000.00", currency: "EUR" }
      }
    });

    expect(result.statusCode).toBe(200);
    expect(observed).toEqual({
      name: "€5m / year",
      horizonStartYear: 2026,
      annualEnvelope: { amount: "5000000.00", currency: "EUR" }
    });
  });

  it("rejects comparing a scenario with itself", async () => {
    app = buildApp({
      budgetScenarioService: scenarioService(),
      budgetService: unusedBudgetService(),
      env: testEnv
    });
    const result = await app.inject({
      method: "GET",
      url: `/api/v1/budget/scenarios/compare?left=${scenarioId}&right=${scenarioId}`
    });
    expect(result.statusCode).toBe(400);
    expect(result.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("returns a structured 409 when an assignment leaves the horizon", async () => {
    app = buildApp({
      budgetScenarioService: scenarioService({
        updateAssignment: () =>
          Promise.resolve({
            outcome: "YEAR_OUT_OF_HORIZON",
            assignedYear: 2035,
            years: [2026, 2027, 2028, 2029, 2030]
          })
      }),
      budgetService: unusedBudgetService(),
      env: testEnv
    });

    const result = await app.inject({
      headers: { "x-request-id": "scenario-horizon" },
      method: "PUT",
      url: `/api/v1/budget/scenarios/${scenarioId}/assignments/44058840-0000-4000-8000-000000000703`,
      payload: { assignedYear: 2035 }
    });

    expect(result.statusCode).toBe(409);
    expect(result.json()).toEqual({
      error: {
        code: "YEAR_OUT_OF_HORIZON",
        details: {
          year: 2035,
          years: [2026, 2027, 2028, 2029, 2030]
        },
        message: "Year is outside the scenario horizon.",
        requestId: "scenario-horizon"
      }
    });
  });

  it("compares two scenarios", async () => {
    app = buildApp({
      budgetScenarioService: scenarioService({
        compare: (left, right) =>
          Promise.resolve({
            outcome: "COMPARED",
            response: {
              asOf: "2026-08-15",
              left: scenarioResponse(left, "Left"),
              right: scenarioResponse(right, "Right")
            }
          })
      }),
      budgetService: unusedBudgetService(),
      env: testEnv
    });

    const result = await app.inject({
      method: "GET",
      url: `/api/v1/budget/scenarios/compare?left=${scenarioId}&right=${otherScenarioId}`
    });

    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      left: { scenario: { name: "Left" } },
      right: { scenario: { name: "Right" } }
    });
  });
});

function scenarioService(
  overrides: Partial<BudgetScenarioService> = {}
): BudgetScenarioService {
  return {
    list: () => Promise.resolve(emptyList()),
    get: (id) => Promise.resolve(scenarioResponse(id, "Draft")),
    create: (input) => Promise.resolve(scenarioResponse(scenarioId, input.name)),
    update: (id) =>
      Promise.resolve({
        outcome: "UPDATED",
        response: scenarioResponse(id, "Draft")
      }),
    remove: () => Promise.resolve({ outcome: "DELETED" }),
    updateAssignment: (id) =>
      Promise.resolve({
        outcome: "UPDATED",
        response: scenarioResponse(id, "Draft")
      }),
    autoFill: (id) =>
      Promise.resolve({
        outcome: "UPDATED",
        response: scenarioResponse(id, "Draft")
      }),
    adopt: (id) =>
      Promise.resolve({
        outcome: "UPDATED",
        response: scenarioResponse(id, "Draft")
      }),
    compare: (left, right) =>
      Promise.resolve({
        outcome: "COMPARED",
        response: {
          asOf: "2026-08-15",
          left: scenarioResponse(left, "Left"),
          right: scenarioResponse(right, "Right")
        }
      }),
    ...overrides
  };
}

function unusedBudgetService(): BudgetService {
  return {
    get: () => Promise.reject(new Error("unused")),
    updateBudget: () => Promise.reject(new Error("unused")),
    updateMembership: () => Promise.reject(new Error("unused"))
  };
}

function emptyList(): BudgetScenarioListResponse {
  return { asOf: "2026-08-15", data: [] };
}

function scenarioResponse(
  id: string,
  name: string
): BudgetScenarioResponse {
  const years = [2026, 2027, 2028, 2029, 2030];
  const emptySummary = {
    selectedProgramValue: { amount: "0.00", currency: "EUR" },
    remainingBudget: null,
    overBudget: null,
    includedInterventions: 0,
    fundedInterventions: 0,
    missingEstimateCount: 0,
    budgetStatus: "NOT_SET" as const
  };
  return {
    asOf: "2026-08-15",
    scenario: {
      id,
      name,
      status: "DRAFT",
      horizonStartYear: 2026,
      horizonYears: 5,
      years,
      currency: "EUR",
      adoptedAt: null,
      createdAt: "2026-08-15T12:00:00.000Z",
      updatedAt: "2026-08-15T12:00:00.000Z"
    },
    envelopes: years.map((year) => ({ year, approvedBudget: null })),
    yearSummaries: years.map((year) => ({
      year,
      envelope: null,
      summary: emptySummary
    })),
    unassigned: {
      count: 0,
      knownCost: { amount: "0.00", currency: "EUR" },
      missingEstimateCount: 0
    },
    data: []
  };
}
