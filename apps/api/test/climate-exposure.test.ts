import { describe, expect, it } from "vitest";

import { hasHighEnvironmentalExposure } from "../src/features/bridges/climate-exposure.js";

const climateStress = {
  freezeThawDays: 53,
  heavyRainDays20: 3,
  deicingDays: 30
};

describe("hasHighEnvironmentalExposure", () => {
  it("requires an open durability finding before climate becomes an attention reason", () => {
    expect(
      hasHighEnvironmentalExposure({
        ...climateStress,
        maximumDurability: 1
      })
    ).toBe(false);
    expect(
      hasHighEnvironmentalExposure({
        freezeThawDays: 0,
        heavyRainDays20: 0,
        deicingDays: 0,
        maximumDurability: 3
      })
    ).toBe(false);
  });

  it("fires on freeze/thaw, heavy rain, or de-icing once durability is at least 2", () => {
    expect(
      hasHighEnvironmentalExposure({
        freezeThawDays: 40,
        heavyRainDays20: 0,
        deicingDays: 0,
        maximumDurability: 2
      })
    ).toBe(true);
    expect(
      hasHighEnvironmentalExposure({
        freezeThawDays: 0,
        heavyRainDays20: 8,
        deicingDays: 0,
        maximumDurability: 2
      })
    ).toBe(true);
    expect(
      hasHighEnvironmentalExposure({
        freezeThawDays: 0,
        heavyRainDays20: 0,
        deicingDays: 25,
        maximumDurability: 2
      })
    ).toBe(true);
  });
});
