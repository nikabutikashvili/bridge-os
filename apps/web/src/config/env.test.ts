import { describe, expect, it } from "vitest";

import { getWebEnv } from "./env";

describe("getWebEnv", () => {
  it("uses a default API URL for local development", () => {
    expect(getWebEnv({}).NEXT_PUBLIC_API_URL).toBe("http://localhost:4000");
  });

  it("rejects invalid API URLs", () => {
    expect(() =>
      getWebEnv({ NEXT_PUBLIC_API_URL: "not-a-url" })
    ).toThrowError(/Invalid web environment/u);
  });
});

