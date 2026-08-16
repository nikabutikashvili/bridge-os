import type {
  BridgeDetailResponse,
  BridgeFindingDetailResponse,
  BridgePortfolioQuery,
  BridgePortfolioResponse
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { BridgePortfolioReader } from "../src/features/bridges/bridge-reader.js";

const bridgeId = "44058840-0000-4000-8000-000000000001";
const findingId = "44058840-0000-4000-8000-000000000304";
const asOf = "2026-08-14";
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

describe("bridge portfolio routes", () => {
  it("validates and passes portfolio filters to the reader", async () => {
    let observedQuery: BridgePortfolioQuery | undefined;
    const reader = createReader({
      listBridges: (query) => {
        observedQuery = query;
        return Promise.resolve(emptyPortfolioResponse(query));
      }
    });
    app = buildApp({ bridgePortfolioReader: reader, env: testEnv });

    const response = await app.inject({
      method: "GET",
      url:
        "/api/v1/bridges?page=2&pageSize=10&road=A57&conditionMin=1.5" +
        "&conditionMax=2.5&constructionYearFrom=1980&constructionYearTo=1990" +
        "&inspectionStatus=CURRENT&hasOpenFinding=true" +
        "&recommendationUrgency=MITTELFRISTIG&findingStatus=OPEN" +
        "&sort=name&direction=asc"
    });

    expect(response.statusCode).toBe(200);
    expect(observedQuery).toEqual({
      conditionMax: 2.5,
      conditionMin: 1.5,
      constructionYearFrom: 1980,
      constructionYearTo: 1990,
      direction: "asc",
      findingStatus: "OPEN",
      inspectionStatus: "CURRENT",
      hasOpenFinding: true,
      page: 2,
      pageSize: 10,
      recommendationUrgency: "MITTELFRISTIG",
      road: "A57",
      sort: "name"
    });
    expect(response.json()).toMatchObject({
      pagination: { page: 2, pageSize: 10, totalItems: 0 }
    });
  });

  it("returns the standardized validation envelope", async () => {
    app = buildApp({ bridgePortfolioReader: createReader(), env: testEnv });

    const response = await app.inject({
      headers: { "x-request-id": "invalid-range" },
      method: "GET",
      url: "/api/v1/bridges?conditionMin=2.3&conditionMax=1.8"
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["x-request-id"]).toBe("invalid-range");
    expect(response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        requestId: "invalid-range"
      }
    });
  });

  it("serves the overview and each workflow projection", async () => {
    app = buildApp({ bridgePortfolioReader: createReader(), env: testEnv });
    const paths = [
      `/api/v1/bridges/${bridgeId}`,
      `/api/v1/bridges/${bridgeId}/inspections`,
      `/api/v1/bridges/${bridgeId}/findings`,
      `/api/v1/bridges/${bridgeId}/findings/${findingId}`,
      `/api/v1/bridges/${bridgeId}/recommendations`,
      `/api/v1/bridges/${bridgeId}/history`,
      `/api/v1/bridges/${bridgeId}/documents`
    ];

    for (const url of paths) {
      const response = await app.inject({ method: "GET", url });
      expect(response.statusCode, url).toBe(200);
      expect(response.json()).toHaveProperty("data");
    }
  });

  it("returns a stable not-found error without leaking reader details", async () => {
    const reader = createReader({ getBridge: () => Promise.resolve(null) });
    app = buildApp({ bridgePortfolioReader: reader, env: testEnv });

    const response = await app.inject({
      headers: { "x-request-id": "missing-bridge" },
      method: "GET",
      url: `/api/v1/bridges/${bridgeId}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "BRIDGE_NOT_FOUND",
        details: { bridgeId },
        message: "Bridge not found.",
        requestId: "missing-bridge"
      }
    });
  });

  it("returns a scoped finding not-found error", async () => {
    const reader = createReader({ getFinding: () => Promise.resolve(null) });
    app = buildApp({ bridgePortfolioReader: reader, env: testEnv });

    const response = await app.inject({
      headers: { "x-request-id": "missing-finding" },
      method: "GET",
      url: `/api/v1/bridges/${bridgeId}/findings/${findingId}`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "FINDING_NOT_FOUND",
        details: { bridgeId, findingId },
        message: "Finding not found for this bridge.",
        requestId: "missing-finding"
      }
    });
  });

  it("serves a stored bridge photograph as JPEG", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const storageKey = `${bridgeId}/bridge-photo.jpg`;
    const storage = new MemoryBridgePhotoStorage(storageKey, jpeg);
    const reader = createReader({
      getBridgePhoto: () => Promise.resolve({ mimeType: "image/jpeg", storageKey })
    });
    app = buildApp({
      bridgePortfolioReader: reader,
      documentStorage: storage,
      env: testEnv
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/bridges/${bridgeId}/photo`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/image\/jpeg/);
    expect(response.rawPayload.equals(jpeg)).toBe(true);
  });

  it("returns a stable missing-photograph error", async () => {
    const reader = createReader({ getBridgePhoto: () => Promise.resolve(null) });
    app = buildApp({ bridgePortfolioReader: reader, env: testEnv });

    const response = await app.inject({
      headers: { "x-request-id": "missing-photo" },
      method: "GET",
      url: `/api/v1/bridges/${bridgeId}/photo`
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "BRIDGE_PHOTO_NOT_FOUND",
        details: { bridgeId },
        message: "No photograph is stored for this bridge.",
        requestId: "missing-photo"
      }
    });
  });
});

function createReader(
  overrides: Partial<BridgePortfolioReader> = {}
): BridgePortfolioReader {
  return {
    getBridge: () => Promise.resolve(bridgeDetail),
    getBridgePhoto: () => Promise.resolve(null),
    getDocuments: () => Promise.resolve({ data: [] }),
    getFinding: () => Promise.resolve(findingDetail),
    getFindings: () => Promise.resolve({ data: [] }),
    getHistory: () => Promise.resolve({ data: [] }),
    getInspections: () => Promise.resolve({ data: [] }),
    getRecommendations: () => Promise.resolve({ data: [] }),
    listBridges: (query) => Promise.resolve(emptyPortfolioResponse(query)),
    ...overrides
  };
}

const findingDetail: BridgeFindingDetailResponse = {
  data: {
    component: {
      id: "44058840-0000-4000-8000-000000000107",
      name: "Fahrbahnanschlüsse und Übergangskonstruktionen",
      type: "FAHRBAHNFUGE"
    },
    defectType: "Schadhafter Fahrbahnanschluss",
    description: "Rissiger Fahrbahnanschluss an beiden Brückenenden.",
    dimensions: null,
    evidence: [],
    extent: "Beide Übergangsbereiche",
    id: findingId,
    inspection: {
      id: "44058840-0000-4000-8000-000000000207",
      inspectedOn: "2023-05-23",
      type: "MAIN"
    },
    linkedRecommendations: [],
    location: "Fahrbahnübergänge Nord und Süd",
    partialStructure: {
      externalNumber: "1",
      id: "44058840-0000-4000-8000-000000000002",
      name: "Heideckhofweg - Teilbauwerk 1 (Demo)"
    },
    quantity: { unit: "m", value: "30.000" },
    ratings: { durability: 2, stability: 0, trafficSafety: 2 },
    sourceIdentifier: "DEMO-S-2023-004",
    status: "OPEN"
  }
};

function emptyPortfolioResponse(
  query: BridgePortfolioQuery
): BridgePortfolioResponse {
  return {
    asOf,
    data: [],
    summary: {
      inspectionsDueOrOverdue: 0,
      structures: 0,
      withNotableFindings: 0,
      withOpenRecommendations: 0
    },
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 0,
      totalPages: 0
    },
    sort: { direction: query.direction, field: query.sort }
  };
}

const bridgeDetail: BridgeDetailResponse = {
  asOf,
  data: {
    attention: {
      highestRecommendationUrgency: null,
      level: "MEDIUM",
      maximumRatings: {
        durability: null,
        stability: null,
        trafficSafety: null
      },
      nextRecommendation: null,
      openFindings: 0,
      openRecommendations: 0,
      reasons: ["MISSING_CRITICAL_DATA"]
    },
    condition: {
      assessedOn: null,
      delta: null,
      inspectionType: null,
      previousScore: null,
      score: null,
      trend: "UNKNOWN"
    },
    dataOrigin: "DEMO_FIXTURE",
    evidence: [],
    externalStructureNumber: "4405884",
    id: bridgeId,
    inspection: {
      latestInspectionOn: null,
      nextDueOn: null,
      status: "UNKNOWN"
    },
    latestTraffic: null,
    photoUrl: null,
    location: {
      countryCode: "DE",
      crossedFeature: null,
      district: null,
      federalState: null,
      latitude: null,
      locality: null,
      longitude: null,
      municipality: null
    },
    name: "Heideckhofweg",
    partialStructures: [],
    responsibility: {
      loadBearingResponsibility: null,
      maintenanceOffice: null,
      owner: null,
      responsibleAuthority: null
    },
    road: "A57",
    technicalData: { components: [] }
  }
};

class MemoryBridgePhotoStorage {
  public constructor(
    private readonly storageKey: string,
    private readonly content: Uint8Array
  ) {}

  public delete(): Promise<void> {
    return Promise.resolve();
  }

  public get(storageKey: string): Promise<Uint8Array> {
    if (storageKey !== this.storageKey) {
      return Promise.reject(new Error("File not found"));
    }
    return Promise.resolve(this.content);
  }

  public put(): Promise<void> {
    return Promise.resolve();
  }
}
