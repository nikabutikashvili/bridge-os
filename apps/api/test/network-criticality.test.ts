import { describe, expect, it } from "vitest";

import {
  deriveNetworkCriticality,
  hasHighNetworkConsequence,
  resolveHeavyVehicleDaily
} from "../src/features/bridges/network-criticality.js";

describe("deriveNetworkCriticality", () => {
  it("keeps a local low-volume crossing in the low band", () => {
    const result = deriveNetworkCriticality({
      additionalDistanceKm: "4.0",
      alternativeCrossingCount: 3,
      dailyTraffic: 3_200,
      heavyVehicleDaily: 200,
      roadClass: "OTHER",
      truckSharePercent: "6.00"
    });

    expect(result.band).toBe("LOW");
    expect(result.points).toBe(0);
    expect(result.extraVehicleKmPerDay).toBe(12_800);
  });

  it("scores the Autobahn valley example as high consequence", () => {
    const result = deriveNetworkCriticality({
      additionalDistanceKm: "37.0",
      alternativeCrossingCount: 0,
      dailyTraffic: 54_000,
      heavyVehicleDaily: 8_100,
      roadClass: "AUTOBAHN",
      truckSharePercent: "15.00"
    });

    expect(result.band).toBe("HIGH");
    expect(result.points).toBe(12);
    expect(result.extraVehicleKmPerDay).toBe(1_998_000);
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "HIGH_VOLUME",
      "HIGH_HGV",
      "LONG_DETOUR",
      "NO_ALTERNATIVE",
      "AUTOBAHN"
    ]);
  });

  it("places Heideckhofweg in the medium band and Alpebachtalbrücke in high", () => {
    expect(
      deriveNetworkCriticality({
        additionalDistanceKm: "9.5",
        alternativeCrossingCount: 2,
        dailyTraffic: 44_291,
        heavyVehicleDaily: 4_562,
        roadClass: "AUTOBAHN",
        truckSharePercent: "10.30"
      })
    ).toMatchObject({ band: "MEDIUM", points: 5 });
    expect(
      deriveNetworkCriticality({
        additionalDistanceKm: "41.0",
        alternativeCrossingCount: 0,
        dailyTraffic: 38_225,
        heavyVehicleDaily: 5_504,
        roadClass: "AUTOBAHN",
        truckSharePercent: "14.40"
      })
    ).toMatchObject({ band: "HIGH", points: 9 });
  });

  it("derives HGV from truck share when the absolute count is missing", () => {
    expect(
      resolveHeavyVehicleDaily({
        dailyTraffic: 38_225,
        heavyVehicleDaily: null,
        truckSharePercent: "14.40"
      })
    ).toBe(5_504);
  });
});

describe("hasHighNetworkConsequence", () => {
  const quiet = {
    conditionScore: "1.8",
    conditionTrend: "STABLE" as const,
    highestRecommendationUrgencyRank: 0,
    maximumDurability: 0,
    maximumStability: 0,
    maximumTrafficSafety: 0,
    networkBand: "HIGH" as const
  };

  it("does not invent urgency on a healthy high-volume structure", () => {
    expect(hasHighNetworkConsequence(quiet)).toBe(false);
  });

  it("fires when a Zustandsnote 3.0 structure sits on a high-consequence link", () => {
    expect(
      hasHighNetworkConsequence({
        ...quiet,
        conditionScore: "3.0"
      })
    ).toBe(true);
  });
});
