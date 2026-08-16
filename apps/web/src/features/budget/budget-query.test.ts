import { describe, expect, it } from "vitest";

import { budgetHref, parseBudgetSearchParams } from "./budget-query";

describe("budget URL model", () => {
  it("defaults to the current planning year", () => {
    expect(parseBudgetSearchParams({}, 2026)).toEqual({ year: 2026 });
  });

  it("round-trips an explicit year", () => {
    expect(parseBudgetSearchParams({ year: ["2027"] }, 2026)).toEqual({
      year: 2027
    });
    expect(budgetHref(2027)).toBe("/budget?year=2027");
  });

  it("rejects planning years outside the domain range", () => {
    expect(() => parseBudgetSearchParams({ year: "1600" }, 2026)).toThrow();
  });
});
