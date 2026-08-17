import { describe, expect, it } from "vitest";

import { adjustForConstructionPriceInflation } from "../src/features/budget/inflation-adjustment.js";

describe("adjustForConstructionPriceInflation", () => {
  it("scales a historical estimate up to a later year's index", () => {
    const result = adjustForConstructionPriceInflation({
      amount: "18000.00",
      currency: "EUR",
      sourceYear: 2023,
      asOfYear: 2025
    });

    expect(result).toMatchObject({
      currency: "EUR",
      sourceYear: 2023,
      asOfYear: 2025,
      extrapolated: false
    });
    // 18000 * 172.6 / 162.5, i.e. roughly +6.2%
    expect(result?.amount).toBe("19118.77");
  });

  it("returns null when the estimate is already dated at or after asOfYear", () => {
    expect(
      adjustForConstructionPriceInflation({
        amount: "1000.00",
        currency: "EUR",
        sourceYear: 2025,
        asOfYear: 2025
      })
    ).toBeNull();
    expect(
      adjustForConstructionPriceInflation({
        amount: "1000.00",
        currency: "EUR",
        sourceYear: 2026,
        asOfYear: 2025
      })
    ).toBeNull();
  });

  it("clamps and flags years outside the indexed range", () => {
    const result = adjustForConstructionPriceInflation({
      amount: "10000.00",
      currency: "EUR",
      sourceYear: 1998,
      asOfYear: 2031
    });

    expect(result).toMatchObject({
      sourceYear: 2005,
      asOfYear: 2025,
      extrapolated: true
    });
  });

  it("keeps money math exact to the cent", () => {
    const result = adjustForConstructionPriceInflation({
      amount: "0.01",
      currency: "EUR",
      sourceYear: 2015,
      asOfYear: 2016
    });

    // 100 -> 101.9 on a single cent should round, not silently drop to 0.00
    expect(result?.amount).toBe("0.01");
  });
});
