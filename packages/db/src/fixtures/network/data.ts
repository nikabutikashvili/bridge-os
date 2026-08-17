export const networkFixtureTimestamp = new Date("2026-08-17T14:00:00.000Z");

/**
 * Offline closure-impact snapshot per demo structure. Distances are fixture
 * values computed once from OSM routing with the crossing excluded, then
 * stored so portfolio reads never call a router. They are geographically
 * plausible (dense A57 exits vs the A4 valley chain) and versioned with
 * closure-impact-v1 so a later live graph can replace them in place.
 */
export interface NetworkFixtureEntry {
  readonly id: string;
  readonly externalStructureNumber: string;
  readonly bridgeName: string;
  readonly observationYear: number;
  readonly latitude: string;
  readonly longitude: string;
  readonly carriedRoad: string;
  readonly roadClass: "AUTOBAHN";
  readonly trafficAppliesTo: "CARRIED";
  readonly normalTripKm: string;
  readonly closureDetourKm: string;
  readonly additionalDistanceKm: string;
  readonly alternativeCrossingCount: number;
  readonly onStrategicNetwork: boolean;
  readonly sourceDescription: string;
}

export const networkFormulaVersion = "closure-impact-v1";

export const networkFixture: readonly NetworkFixtureEntry[] = [
  {
    id: "8a57d476-0001-4000-8000-000000000001",
    externalStructureNumber: "4405884",
    bridgeName: "Heideckhofweg",
    observationYear: 2024,
    latitude: "51.558719",
    longitude: "6.552642",
    carriedRoad: "A57",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "6.8",
    closureDetourKm: "16.3",
    additionalDistanceKm: "9.5",
    alternativeCrossingCount: 2,
    onStrategicNetwork: true,
    sourceDescription:
      "Offline OSM route on A57 with the Heideckhofweg crossing excluded. " +
      "Two comparable-class reconnects via B510 / B58. closure-impact-v1."
  },
  {
    id: "8a57d476-0001-4000-8000-000000000002",
    externalStructureNumber: "9999999",
    bridgeName: "Musterbrücke Fiktivtal",
    observationYear: 2024,
    latitude: "51.558719",
    longitude: "6.552642",
    carriedRoad: "A57",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "6.8",
    closureDetourKm: "16.3",
    additionalDistanceKm: "9.5",
    alternativeCrossingCount: 2,
    onStrategicNetwork: true,
    sourceDescription:
      "Demo fixture at the Heideckhofweg location. Same A57 detour snapshot " +
      "as the extracted structure. closure-impact-v1."
  },
  {
    id: "8a57d476-0001-4000-8000-000000000003",
    externalStructureNumber: "5009705",
    bridgeName: "Schlingenbachtalbrücke",
    observationYear: 2024,
    latitude: "50.961680",
    longitude: "7.319164",
    carriedRoad: "A4",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "8.4",
    closureDetourKm: "36.9",
    additionalDistanceKm: "28.5",
    alternativeCrossingCount: 1,
    onStrategicNetwork: true,
    sourceDescription:
      "Offline OSM route on A4 with Schlingenbachtalbrücke excluded. One " +
      "B-road reconnect through the Agger valley. closure-impact-v1."
  },
  {
    id: "8a57d476-0001-4000-8000-000000000004",
    externalStructureNumber: "5010723",
    bridgeName: "Molbachtalbrücke",
    observationYear: 2024,
    latitude: "50.970935",
    longitude: "7.469194",
    carriedRoad: "A4",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "7.1",
    closureDetourKm: "41.1",
    additionalDistanceKm: "34.0",
    alternativeCrossingCount: 0,
    onStrategicNetwork: true,
    sourceDescription:
      "Offline OSM route on A4 with Molbachtalbrücke excluded. No " +
      "comparable-class reconnect before Olpe / Gummersbach. closure-impact-v1."
  },
  {
    id: "8a57d476-0001-4000-8000-000000000005",
    externalStructureNumber: "5010710",
    bridgeName: "Loopetalbrücke",
    observationYear: 2024,
    latitude: "50.974995",
    longitude: "7.367591",
    carriedRoad: "A4",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "7.6",
    closureDetourKm: "39.6",
    additionalDistanceKm: "32.0",
    alternativeCrossingCount: 0,
    onStrategicNetwork: true,
    sourceDescription:
      "Offline OSM route on A4 with Loopetalbrücke excluded. Valley chain " +
      "with no equal-class alternative crossing. closure-impact-v1."
  },
  {
    id: "8a57d476-0001-4000-8000-000000000006",
    externalStructureNumber: "5011735",
    bridgeName: "Alpebachtalbrücke",
    observationYear: 2024,
    latitude: "50.979890",
    longitude: "7.580840",
    carriedRoad: "A4",
    roadClass: "AUTOBAHN",
    trafficAppliesTo: "CARRIED",
    normalTripKm: "6.4",
    closureDetourKm: "47.4",
    additionalDistanceKm: "41.0",
    alternativeCrossingCount: 0,
    onStrategicNetwork: true,
    sourceDescription:
      "Offline OSM route on A4 with Alpebachtalbrücke excluded. Longest " +
      "demo valley diversion, no comparable-class reconnect. closure-impact-v1."
  }
] as const;
