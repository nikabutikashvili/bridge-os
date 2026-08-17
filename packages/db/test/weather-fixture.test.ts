import { z } from "zod";
import { describe, expect, it } from "vitest";

import { weatherFixture, weatherFormulaVersion } from "../src/fixtures/weather/index.js";

describe("weather development fixture", () => {
  it("uses stable unique metric UUIDs and twelve-month arrays", () => {
    const ids = weatherFixture.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => z.string().uuid().safeParse(id).success)).toBe(true);
    expect(weatherFixture).toHaveLength(12);
    expect(
      weatherFixture.every(
        (entry) =>
          entry.monthlyPrecipMm.length === 12 && entry.monthlyFreezeThawDays.length === 12
      )
    ).toBe(true);
    expect(weatherFormulaVersion).toBe("weather-metrics-v1");
  });

  it("covers each demo structure for 2024 and 2025", () => {
    const keys = weatherFixture.map(
      (entry) => `${entry.externalStructureNumber}:${String(entry.observationYear)}`
    );

    expect(new Set(keys)).toEqual(
      new Set([
        "4405884:2024",
        "4405884:2025",
        "9999999:2024",
        "9999999:2025",
        "5009705:2024",
        "5009705:2025",
        "5010723:2024",
        "5010723:2025",
        "5010710:2024",
        "5010710:2025",
        "5011735:2024",
        "5011735:2025"
      ])
    );
  });
});
