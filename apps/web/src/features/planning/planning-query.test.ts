import { describe, expect, it } from "vitest";

import {
  parsePlanningSearchParams,
  planningHref
} from "./planning-query";

describe("planning URL model", () => {
  it("uses the recommended work queue as the default view", () => {
    expect(parsePlanningSearchParams({})).toEqual({
      page: 1,
      pageSize: 25,
      view: "recommended-unplanned"
    });
    expect(planningHref("recommended-unplanned")).toBe("/planning");
  });

  it("round-trips lifecycle state and pagination", () => {
    expect(
      parsePlanningSearchParams({
        page: "3",
        pageSize: "10",
        view: "tender-preparation"
      })
    ).toEqual({ page: 3, pageSize: 10, view: "tender-preparation" });
    expect(planningHref("tender-preparation", 3)).toBe(
      "/planning?view=tender-preparation&page=3"
    );
  });

  it("rejects unknown lifecycle states", () => {
    expect(() => parsePlanningSearchParams({ view: "approved-ish" })).toThrow();
  });
});
