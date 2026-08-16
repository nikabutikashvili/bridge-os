import { citation, missing, sourced } from "./shared.js";

export const trafficModelFixture = {
  category: "TRAFFIC_NETWORK",
  trafficObservations: [
    {
      sourceKey: "traffic:2015",
      evidence: [citation(6, "Verkehrszählung 2015 DTV 41.878 Kfz/24h")],
      observationYear: sourced("2015", 6, "Verkehrszählung 2015"),
      observedOn: missing(),
      dailyTraffic: sourced("41.878", 6, "DTV 41.878 Kfz/24h"),
      truckSharePercent: sourced("9", 6, "Schwerverkehr 9 %"),
      sourceDescription: missing()
    }
  ]
} as const;

export const trafficPage = {
  pageNumber: 6,
  textContent: "Verkehrszählung 2015 DTV 41.878 Kfz/24h Schwerverkehr 9 %"
} as const;
