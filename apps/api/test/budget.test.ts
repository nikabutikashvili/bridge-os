import type {
  BudgetQuery,
  BudgetResponse,
  UpdateBudget
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type {
  BudgetService,
  UpdateBudgetMembershipResult
} from "../src/features/budget/budget-service.js";

const interventionId = "44058840-0000-4000-8000-000000000703";
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

describe("budget routes", () => {
  it("validates and forwards the selected planning year", async () => {
    let observed: BudgetQuery | undefined;
    app = buildApp({
      budgetService: service({
        get: (query) => {
          observed = query;
          return Promise.resolve(response(query.year));
        }
      }),
      env: testEnv
    });

    const result = await app.inject({ method: "GET", url: "/api/v1/budget?year=2027" });

    expect(result.statusCode).toBe(200);
    expect(observed).toEqual({ year: 2027 });
  });

  it("updates the approved planning budget", async () => {
    let observed: UpdateBudget | undefined;
    app = buildApp({
      budgetService: service({
        updateBudget: (year, input) => {
          expect(year).toBe(2026);
          observed = input;
          return Promise.resolve(response(year));
        }
      }),
      env: testEnv
    });

    const result = await app.inject({
      method: "PUT",
      url: "/api/v1/budget/2026",
      payload: { approvedBudget: { amount: "60000.00", currency: "EUR" } }
    });

    expect(result.statusCode).toBe(200);
    expect(observed).toEqual({
      approvedBudget: { amount: "60000.00", currency: "EUR" }
    });
  });

  it("returns a structured conflict for cross-year membership", async () => {
    app = buildApp({
      budgetService: service({
        updateMembership: () =>
          Promise.resolve({
            outcome: "INTERVENTION_YEAR_MISMATCH",
            interventionId,
            interventionYear: 2027,
            requestedYear: 2026
          })
      }),
      env: testEnv
    });

    const result = await app.inject({
      headers: { "x-request-id": "budget-year-conflict" },
      method: "PUT",
      url: `/api/v1/budget/2026/interventions/${interventionId}`,
      payload: { included: true }
    });

    expect(result.statusCode).toBe(409);
    expect(result.json()).toEqual({
      error: {
        code: "INTERVENTION_YEAR_MISMATCH",
        details: { interventionId, interventionYear: 2027, requestedYear: 2026 },
        message: "Intervention belongs to a different planning year.",
        requestId: "budget-year-conflict"
      }
    });
  });

  it("rejects malformed monetary input at the boundary", async () => {
    app = buildApp({ budgetService: service(), env: testEnv });
    const result = await app.inject({
      method: "PUT",
      url: "/api/v1/budget/2026",
      payload: { approvedBudget: { amount: 60000, currency: "EUR" } }
    });
    expect(result.statusCode).toBe(400);
    expect(result.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});

function service(overrides: Partial<BudgetService> = {}): BudgetService {
  return {
    get: ({ year }) => Promise.resolve(response(year)),
    updateBudget: (year) => Promise.resolve(response(year)),
    updateMembership: (year: number): Promise<UpdateBudgetMembershipResult> =>
      Promise.resolve({ outcome: "UPDATED", response: response(year) }),
    ...overrides
  };
}

function response(year: number): BudgetResponse {
  return {
    asOf: "2026-08-15",
    availableYears: [year],
    program: {
      id: null,
      planningYear: year,
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
  };
}
