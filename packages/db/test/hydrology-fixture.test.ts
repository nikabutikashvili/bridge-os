import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  hydrologyFloodEventFixture,
  hydrologyFormulaVersion,
  hydrologyMetricFixture
} from "../src/fixtures/hydrology/index.js";

describe("hydrology development fixture", () => {
  it("uses stable unique metric and event UUIDs", () => {
    const ids = [
      ...hydrologyMetricFixture.map((entry) => entry.id),
      ...hydrologyFloodEventFixture.map((entry) => entry.id)
    ];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => z.string().uuid().safeParse(id).success)).toBe(true);
    expect(hydrologyFormulaVersion).toBe("hydrology-metrics-v1");
  });

  it("seeds Wesel as the nearest gauge and Köln archive peaks for Musterbrücke", () => {
    expect(hydrologyMetricFixture).toHaveLength(1);
    expect(hydrologyMetricFixture[0]).toMatchObject({
      externalStructureNumber: "9999999",
      stationName: "WESEL",
      waterLevelCm: 66,
      inspectionTriggerCm: 804
    });
    expect(
      hydrologyFloodEventFixture.map((entry) => entry.eventYear).sort((left, right) => left - right)
    ).toEqual([1995, 2011, 2013, 2018, 2021]);
    expect(hydrologyFloodEventFixture.every((entry) => entry.stationName === "KÖLN")).toBe(true);
  });
});
