import type {
  CreateWorkPackage,
  WorkPackageDetailResponse,
  WorkPackageListResponse
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type {
  CreateWorkPackageResult,
  DeleteWorkPackageResult,
  WorkPackageService
} from "../src/features/work-packages/work-package-service.js";

const interventionId = "44058840-0000-4000-8000-000000000703";
const workPackageId = "44058840-0000-4000-8000-000000000950";
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

describe("work package routes", () => {
  it("lists work packages and eligible interventions", async () => {
    app = buildApp({ env: testEnv, workPackageService: service() });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/work-packages"
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], eligibleInterventions: [] });
  });

  it("creates a package from a validated intervention decision", async () => {
    let observed: CreateWorkPackage | undefined;
    app = buildApp({
      env: testEnv,
      workPackageService: service({
        create: (input) => {
          observed = input;
          return Promise.resolve(createdResult());
        }
      })
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/work-packages",
      payload: { plannedInterventionId: interventionId }
    });
    expect(response.statusCode).toBe(201);
    expect(observed).toEqual({ plannedInterventionId: interventionId });
  });

  it("returns a structured duplicate conflict", async () => {
    app = buildApp({
      env: testEnv,
      workPackageService: service({
        create: () =>
          Promise.resolve({
            outcome: "WORK_PACKAGE_ALREADY_EXISTS",
            plannedInterventionId: interventionId,
            workPackageId
          })
      })
    });
    const response = await app.inject({
      headers: { "x-request-id": "duplicate-work-package" },
      method: "POST",
      url: "/api/v1/work-packages",
      payload: { plannedInterventionId: interventionId }
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: "WORK_PACKAGE_ALREADY_EXISTS",
        details: { plannedInterventionId: interventionId, workPackageId },
        message: "A work package already exists for this intervention.",
        requestId: "duplicate-work-package"
      }
    });
  });

  it("rejects invalid intervention identifiers at the boundary", async () => {
    app = buildApp({ env: testEnv, workPackageService: service() });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/work-packages",
      payload: { plannedInterventionId: "not-a-uuid" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("deletes a work package", async () => {
    let observedId: string | undefined;
    app = buildApp({
      env: testEnv,
      workPackageService: service({
        remove: (id) => {
          observedId = id;
          return Promise.resolve({
            outcome: "DELETED",
            plannedInterventionId: interventionId
          } satisfies DeleteWorkPackageResult);
        }
      })
    });
    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/work-packages/${workPackageId}`
    });
    expect(response.statusCode).toBe(204);
    expect(observedId).toBe(workPackageId);
  });

  it("returns a structured not-found error deleting a missing work package", async () => {
    app = buildApp({
      env: testEnv,
      workPackageService: service({
        remove: () =>
          Promise.resolve({
            outcome: "WORK_PACKAGE_NOT_FOUND",
            workPackageId
          })
      })
    });
    const response = await app.inject({
      headers: { "x-request-id": "missing-work-package" },
      method: "DELETE",
      url: `/api/v1/work-packages/${workPackageId}`
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "WORK_PACKAGE_NOT_FOUND",
        details: { workPackageId },
        message: "Work package not found.",
        requestId: "missing-work-package"
      }
    });
  });
});

function service(overrides: Partial<WorkPackageService> = {}): WorkPackageService {
  return {
    list: () => Promise.resolve(emptyList()),
    get: () => Promise.resolve(null),
    create: () => Promise.resolve(createdResult()),
    remove: () =>
      Promise.resolve({ outcome: "DELETED", plannedInterventionId: interventionId }),
    ...overrides
  };
}

function emptyList(): WorkPackageListResponse {
  return { data: [], eligibleInterventions: [] };
}

function createdResult(): CreateWorkPackageResult {
  return {
    outcome: "CREATED",
    response: {
      data: {
        id: workPackageId
      }
    } as unknown as WorkPackageDetailResponse
  };
}
