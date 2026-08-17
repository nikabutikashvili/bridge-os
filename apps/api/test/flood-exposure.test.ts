import { describe, expect, it } from "vitest";

import {
  deriveFloodBand,
  deriveFloodExposure,
  hasHighFloodExposure,
  type FloodExposureInput
} from "../src/features/bridges/flood-exposure.js";

const koelnThresholds = {
  mhwCm: 725,
  hswCm: 830,
  hhwCm: 1069,
  markeICm: 620,
  markeIICm: 830
};

const weselCurrent = {
  waterLevelCm: 66,
  inspectionTriggerCm: 804,
  stationName: "WESEL",
  waterName: "RHEIN",
  thresholds: {
    mhwCm: 804,
    hswCm: 1060,
    hhwCm: 1231,
    markeICm: 870,
    markeIICm: 1060
  }
};

const events = [
  {
    eventYear: 2021,
    peakedOn: "2021-02-07",
    peakWaterLevelCm: 869,
    stationName: "KÖLN",
    waterName: "RHEIN",
    ...koelnThresholds
  },
  {
    eventYear: 2018,
    peakedOn: "2018-01-08",
    peakWaterLevelCm: 878,
    stationName: "KÖLN",
    waterName: "RHEIN",
    ...koelnThresholds
  },
  {
    eventYear: 2013,
    peakedOn: "2013-06-05",
    peakWaterLevelCm: 765,
    stationName: "KÖLN",
    waterName: "RHEIN",
    ...koelnThresholds
  },
  {
    eventYear: 2011,
    peakedOn: "2011-01-16",
    peakWaterLevelCm: 891,
    stationName: "KÖLN",
    waterName: "RHEIN",
    ...koelnThresholds
  }
] as const;

const musterbruecke: FloodExposureInput = {
  crossedFeature: "Fiktivbach",
  current: weselCurrent,
  events,
  inspections: [
    { id: "special-2011", type: "SPECIAL", inspectedOn: "2011-03-15" },
    { id: "main-2011", type: "MAIN", inspectedOn: "2011-05-17" }
  ],
  findings: [
    {
      id: "kolk",
      defectType: "Kolk / Unterspülung",
      description: "Lokale Kolkbildung am nördlichen Widerlager.",
      sourceIdentifier: "DEMO-S-2011-001",
      status: "RESOLVED",
      inspectedOn: "2011-03-15"
    }
  ],
  historicalWorks: [
    {
      id: "repair-2012",
      title: "Kolkverfüllung und Widerlagersicherung (Demo)",
      reason: "Sonderprüfung nach Rheinhochwasser 2011",
      startedOn: "2012-04-02",
      endedOn: "2012-06-15"
    }
  ],
  components: [{ type: "WIDERLAGER" }]
};

describe("deriveFloodBand", () => {
  it("classifies Köln archive peaks against Köln characteristic values", () => {
    expect(deriveFloodBand(1069, koelnThresholds)).toBe("EXTREME");
    expect(deriveFloodBand(891, koelnThresholds)).toBe("HIGH");
    expect(deriveFloodBand(765, koelnThresholds)).toBe("MODERATE");
    expect(deriveFloodBand(66, weselCurrent.thresholds)).toBe("BELOW_TRIGGER");
  });
});

describe("deriveFloodExposure", () => {
  it("recommends a Sonderprüfung after the latest unmatched high-water event", () => {
    const assessment = deriveFloodExposure(musterbruecke);

    expect(assessment.triggerExceeded).toBe(false);
    expect(assessment.scourSensitive).toBe(true);
    expect(assessment.hasOpenScourFinding).toBe(false);
    expect(assessment.unmatchedPostFloodInspection).toBe(true);
    expect(assessment.recommendedAction).toMatchObject({
      kind: "EXTRAORDINARY_INSPECTION",
      eventYear: 2021
    });
    expect(assessment.summary).toMatch(/2021 high-water event/i);
    expect(hasHighFloodExposure(assessment)).toBe(true);

    const event2011 = assessment.history.find((event) => event.eventYear === 2011);
    expect(event2011).toMatchObject({
      band: "HIGH",
      specialInspection: { inspectedOn: "2011-03-15" },
      scourFinding: { id: "kolk" },
      repair: { id: "repair-2012" }
    });
    const event2021 = assessment.history.find((event) => event.eventYear === 2021);
    expect(event2021?.specialInspection).toBeNull();
  });

  it("does not invent a flood watch on a road crossing without a gauge story", () => {
    const assessment = deriveFloodExposure({
      ...musterbruecke,
      crossedFeature: "Heideckhofweg",
      findings: [],
      components: []
    });

    expect(assessment.scourSensitive).toBe(false);
    expect(assessment.recommendedAction).toBeNull();
    expect(hasHighFloodExposure(assessment)).toBe(false);
  });
});
