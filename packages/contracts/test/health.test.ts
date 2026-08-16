import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "../src/index.js";

describe("healthResponseSchema", () => {
  it("accepts the health response contract", () => {
    expect(
      healthResponseSchema.safeParse({
        service: "api",
        status: "ok",
        timestamp: "2026-08-14T18:00:00.000Z"
      }).success
    ).toBe(true);
  });
});

