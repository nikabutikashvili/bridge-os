import {
  globalSearchQuerySchema,
  globalSearchResponseSchema
} from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

describe("global search contracts", () => {
  it("normalizes the query and applies a conservative group limit", () => {
    expect(globalSearchQuerySchema.parse({ q: "  A57  " })).toEqual({
      limit: 5,
      q: "A57"
    });
  });

  it("rejects queries that are too short or excessive result limits", () => {
    expect(globalSearchQuerySchema.safeParse({ q: "A" }).success).toBe(false);
    expect(
      globalSearchQuerySchema.safeParse({ limit: 11, q: "A57" }).success
    ).toBe(false);
  });

  it("keeps results grouped by operational record type", () => {
    const result = globalSearchResponseSchema.parse({
      query: "A57",
      groups: {
        bridges: { items: [], totalItems: 1 },
        findings: { items: [], totalItems: 0 },
        recommendations: { items: [], totalItems: 0 }
      }
    });

    expect(result.groups.bridges.totalItems).toBe(1);
  });
});
