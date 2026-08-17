export const bastTrafficFixtureTimestamp = new Date("2026-08-17T00:00:00.000Z");

/**
 * One automatic-counting-station match per bridge from the five demo Bauwerksbuch
 * PDFs, keyed by the bridge's external structure number (a stable business key,
 * unlike the bridge's database id which depends on when/where extraction ran).
 *
 * Coordinates are geocoded from each bridge's extracted locality/municipality
 * (only filled in when the bridge has none yet) and the traffic figures come
 * from BASt's public "Automatische Zählstellen" annual dataset (Jawe2024.csv,
 * https://www.bast.de - Straßenverkehrszählung), matched to the nearest station
 * on the bridge's own road by great-circle distance.
 */
export interface BastTrafficFixtureEntry {
  readonly id: string;
  readonly externalStructureNumber: string;
  readonly bridgeName: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly observationYear: number;
  readonly dailyTraffic: number;
  readonly truckSharePercent: string;
  readonly sourceDescription: string;
}

export const bastTrafficFixture: readonly BastTrafficFixtureEntry[] = [
  {
    id: "8a57d474-0001-4000-8000-000000000001",
    externalStructureNumber: "4405884",
    bridgeName: "Heideckhofweg",
    latitude: "51.558719",
    longitude: "6.552642",
    observationYear: 2024,
    dailyTraffic: 44_291,
    truckSharePercent: "10.30",
    sourceDescription:
      "BASt Dauerzählstelle „Rheinberg“ (A57), ca. 1.9 km vom Bauwerk entfernt " +
      "— Jahresauswertung automatischer Zählstellen 2024 (bast.de)."
  },
  {
    id: "8a57d474-0001-4000-8000-000000000002",
    externalStructureNumber: "5009705",
    bridgeName: "Schlingenbachtalbrücke",
    latitude: "50.961680",
    longitude: "7.319164",
    observationYear: 2024,
    dailyTraffic: 50_593,
    truckSharePercent: "12.10",
    sourceDescription:
      "BASt Dauerzählstelle „Engelskirchen“ (A4), ca. 3.8 km vom Bauwerk entfernt " +
      "— Jahresauswertung automatischer Zählstellen 2024 (bast.de)."
  },
  {
    id: "8a57d474-0001-4000-8000-000000000003",
    externalStructureNumber: "5010723",
    bridgeName: "Molbachtalbrücke",
    latitude: "50.970935",
    longitude: "7.469194",
    observationYear: 2024,
    dailyTraffic: 50_593,
    truckSharePercent: "12.10",
    sourceDescription:
      "BASt Dauerzählstelle „Engelskirchen“ (A4), ca. 6.9 km vom Bauwerk entfernt " +
      "— Jahresauswertung automatischer Zählstellen 2024 (bast.de)."
  },
  {
    id: "8a57d474-0001-4000-8000-000000000004",
    externalStructureNumber: "5010710",
    bridgeName: "Loopetalbrücke",
    latitude: "50.974995",
    longitude: "7.367591",
    observationYear: 2024,
    dailyTraffic: 50_593,
    truckSharePercent: "12.10",
    sourceDescription:
      "BASt Dauerzählstelle „Engelskirchen“ (A4), ca. 0.5 km vom Bauwerk entfernt " +
      "— Jahresauswertung automatischer Zählstellen 2024 (bast.de)."
  },
  {
    id: "8a57d474-0001-4000-8000-000000000005",
    externalStructureNumber: "5011735",
    bridgeName: "Alpebachtalbrücke",
    latitude: null,
    longitude: null,
    observationYear: 2024,
    dailyTraffic: 38_225,
    truckSharePercent: "14.40",
    sourceDescription:
      "BASt Dauerzählstelle „Eckenhagen“ (A4), ca. 5.2 km vom Bauwerk entfernt " +
      "— Jahresauswertung automatischer Zählstellen 2024 (bast.de)."
  }
] as const;
