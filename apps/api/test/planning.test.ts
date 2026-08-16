import type {
  CreatePlannedIntervention,
  PlanningQuery,
  PlanningResponse
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type {
  CreateInterventionResult,
  PlanningService
} from "../src/features/planning/planning-service.js";

const recommendationId = "44058840-0000-4000-8000-000000000404";
const interventionId = "44058840-0000-4000-8000-000000000704";
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

describe("planning routes", () => {
  it("validates and passes lifecycle pagination to the service", async () => {
    let observedQuery: PlanningQuery | undefined;
    app = buildApp({
      env: testEnv,
      planningService: createService({
        list: (query) => {
          observedQuery = query;
          return Promise.resolve(emptyResponse(query));
        }
      })
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/planning?view=tender-preparation&page=2&pageSize=10"
    });

    expect(response.statusCode).toBe(200);
    expect(observedQuery).toEqual({
      page: 2,
      pageSize: 10,
      view: "tender-preparation"
    });
    expect(response.json()).toMatchObject({
      pagination: { page: 2, pageSize: 10 },
      view: "tender-preparation"
    });
  });

  it("creates a managerial intervention from an explicit decision", async () => {
    let observedInput: CreatePlannedIntervention | undefined;
    app = buildApp({
      env: testEnv,
      planningService: createService({
        createFromRecommendation: (input) => {
          observedInput = input;
          return Promise.resolve(createdResult());
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/planning/interventions",
      payload: {
        recommendationId,
        workType: "Drainage repair",
        plannedYear: 2027,
        quantity: { value: "4.000", unit: "m²" },
        estimatedCost: { amount: "14000.00", currency: "EUR" }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(observedInput).toEqual({
      recommendationId,
      workType: "Drainage repair",
      plannedYear: 2027,
      quantity: { value: "4.000", unit: "m²" },
      estimatedCost: { amount: "14000.00", currency: "EUR" }
    });
    expect(response.json()).toMatchObject({
      data: { id: interventionId, status: "PLANNED" }
    });
  });

  it("returns a structured conflict when the recommendation is already planned", async () => {
    app = buildApp({
      env: testEnv,
      planningService: createService({
        createFromRecommendation: () =>
          Promise.resolve({
            interventionId,
            outcome: "INTERVENTION_ALREADY_EXISTS",
            recommendationId
          })
      })
    });

    const response = await app.inject({
      headers: { "x-request-id": "duplicate-plan" },
      method: "POST",
      url: "/api/v1/planning/interventions",
      payload: {
        recommendationId,
        workType: "Drainage repair",
        plannedYear: 2027
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "INTERVENTION_ALREADY_EXISTS",
        details: { interventionId, recommendationId },
        message: "A planned intervention already exists for this recommendation.",
        requestId: "duplicate-plan"
      }
    });
  });

  it("rejects incomplete decisions at the HTTP boundary", async () => {
    app = buildApp({ env: testEnv, planningService: createService() });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/planning/interventions",
      payload: { recommendationId, workType: "", plannedYear: 2027 }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" }
    });
  });
});

function createService(
  overrides: Partial<PlanningService> = {}
): PlanningService {
  return {
    createFromRecommendation: () => Promise.resolve(createdResult()),
    list: (query) => Promise.resolve(emptyResponse(query)),
    ...overrides
  };
}

function createdResult(): CreateInterventionResult {
  return {
    outcome: "CREATED",
    response: {
      data: {
        id: interventionId,
        createdAt: "2026-08-15T10:00:00.000Z",
        estimatedCost: null,
        estimatedCostSource: null,
        estimatedCostStatus: null,
        plannedYear: 2027,
        quantity: null,
        status: "PLANNED",
        workType: "Drainage repair"
      }
    }
  };
}

function emptyResponse(query: PlanningQuery): PlanningResponse {
  return {
    asOf: "2026-08-15",
    data: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 0,
      totalPages: 0
    },
    summary: {
      recommendedUnplanned: 0,
      planned: 0,
      budgeted: 0,
      tenderPreparation: 0,
      tenderedReady: 0,
      inProgress: 0,
      completed: 0
    },
    view: query.view
  };
}
