import { describe, expect, it } from "vitest";

import {
  budgetCompareHref,
  budgetHref,
  budgetScenariosHref,
  parseBudgetSearchParams
} from "./budget-query";

describe("budget URL model", () => {
  it("defaults to the scenario workspace", () => {
    expect(parseBudgetSearchParams({}, 2026)).toEqual({
      view: "scenarios",
      year: 2026,
      scenarioId: null,
      leftId: null,
      rightId: null
    });
  });

  it("keeps year-only bookmarks on the live programme", () => {
    expect(parseBudgetSearchParams({ year: ["2027"] }, 2026)).toEqual({
      view: "program",
      year: 2027,
      scenarioId: null,
      leftId: null,
      rightId: null
    });
    expect(budgetHref(2027)).toBe("/budget?year=2027");
  });

  it("round-trips scenario and compare URLs", () => {
    const scenarioId = "44058840-0000-4000-8000-000000000901";
    const otherId = "44058840-0000-4000-8000-000000000902";
    expect(
      parseBudgetSearchParams({ view: "scenarios", id: scenarioId }, 2026)
    ).toEqual({
      view: "scenarios",
      year: 2026,
      scenarioId,
      leftId: null,
      rightId: null
    });
    expect(budgetScenariosHref(scenarioId)).toBe(
      `/budget?view=scenarios&id=${scenarioId}`
    );
    expect(budgetCompareHref(scenarioId, otherId)).toBe(
      `/budget?view=compare&left=${scenarioId}&right=${otherId}`
    );
  });

  it("rejects planning years outside the domain range", () => {
    expect(() => parseBudgetSearchParams({ year: "1600" }, 2026)).toThrow();
  });
});
