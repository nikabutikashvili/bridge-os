import { describe, expect, it } from "vitest";

import {
  parsePortfolioSearchParams,
  portfolioHref
} from "./portfolio-query";

describe("portfolio URL state", () => {
  it("drops empty form values and applies monitoring defaults", () => {
    expect(
      parsePortfolioSearchParams({ road: "", hasOpenFinding: "true" })
    ).toMatchObject({
      direction: "desc",
      hasOpenFinding: true,
      page: 1,
      pageSize: 25,
      sort: "attention"
    });
  });

  it("preserves filters while changing pages", () => {
    const query = parsePortfolioSearchParams({
      conditionMax: "2.5",
      road: "A57"
    });

    expect(portfolioHref(query, { page: 2 })).toBe(
      "/bridges?page=2&road=A57&conditionMax=2.5"
    );
  });
});
