import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const testEnv = {
  API_HOST: "127.0.0.1",
  API_PORT: 4000,
  DATABASE_URL: "postgres://bridge_os:bridge_os@localhost:5432/bridge_os",
  DOCUMENT_MAX_UPLOAD_BYTES: 25 * 1_024 * 1_024,
  DOCUMENT_STORAGE_ROOT: ".data/test-documents",
  LOG_LEVEL: "silent",
  NODE_ENV: "test"
} as const;

describe("GET /health", () => {
  it("returns service health and echoes request id", async () => {
    const app = buildApp({ env: testEnv });

    const response = await app.inject({
      headers: {
        "x-request-id": "test-request-id"
      },
      method: "GET",
      url: "/health"
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("test-request-id");
    expect(response.json()).toMatchObject({
      service: "api",
      status: "ok"
    });
  });
});
