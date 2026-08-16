import { describe, expect, it } from "vitest";

import { absoluteApiUrl } from "./api-url";

describe("absoluteApiUrl", () => {
  it("resolves an API path against the public API origin", () => {
    expect(absoluteApiUrl("/api/v1/bridges/abc/photo")).toBe(
      "http://localhost:4000/api/v1/bridges/abc/photo"
    );
  });
});
