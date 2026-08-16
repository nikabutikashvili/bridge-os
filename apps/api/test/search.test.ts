import type {
  GlobalSearchQuery,
  GlobalSearchResponse
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { escapeIlikeLiteral } from "../src/features/search/postgres-search-reader.js";
import type { GlobalSearchReader } from "../src/features/search/search-reader.js";

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

describe("global search route", () => {
  it("validates, trims, and passes the search query to the reader", async () => {
    let observedQuery: GlobalSearchQuery | undefined;
    app = buildApp({
      env: testEnv,
      searchReader: createReader((query) => {
        observedQuery = query;
        return Promise.resolve(emptyResponse(query.q));
      })
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/search?q=%20Heideckhofweg%20&limit=3"
    });

    expect(response.statusCode).toBe(200);
    expect(observedQuery).toEqual({ limit: 3, q: "Heideckhofweg" });
    expect(response.json()).toEqual(emptyResponse("Heideckhofweg"));
  });

  it("returns the standard validation envelope for a short query", async () => {
    app = buildApp({ env: testEnv, searchReader: createReader() });

    const response = await app.inject({
      headers: { "x-request-id": "short-search" },
      method: "GET",
      url: "/api/v1/search?q=A"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        requestId: "short-search"
      }
    });
  });
});

describe("ILIKE literal escaping", () => {
  it("escapes wildcard and escape characters", () => {
    expect(escapeIlikeLiteral("A_57%\\north")).toBe("A\\_57\\%\\\\north");
  });
});

function createReader(
  search: GlobalSearchReader["search"] = (query) =>
    Promise.resolve(emptyResponse(query.q))
): GlobalSearchReader {
  return { search };
}

function emptyResponse(query: string): GlobalSearchResponse {
  return {
    query,
    groups: {
      bridges: { items: [], totalItems: 0 },
      findings: { items: [], totalItems: 0 },
      recommendations: { items: [], totalItems: 0 }
    }
  };
}
