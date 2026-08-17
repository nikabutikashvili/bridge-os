export const hydrologyFixtureTimestamp = new Date("2026-08-17T13:15:00.000Z");

export const hydrologyFormulaVersion = "hydrology-metrics-v1";

export const weselStation = {
  uuid: "f33c3cc9-dc4b-4b77-baa9-5a5f10704398",
  name: "WESEL",
  number: "2770040",
  waterName: "RHEIN",
  riverKm: "814.000",
  latitude: "51.646143",
  longitude: "6.606820"
} as const;

export const koelnStation = {
  uuid: "a6ee8177-107b-47dd-bcfd-30960ccc6e9c",
  name: "KÖLN",
  waterName: "RHEIN"
} as const;

export const koelnThresholds = {
  mhwCm: 725,
  hswCm: 830,
  hhwCm: 1069,
  markeICm: 620,
  markeIICm: 830
} as const;

export interface HydrologyMetricFixture {
  readonly id: string;
  readonly externalStructureNumber: string;
  readonly bridgeName: string;
  readonly stationUuid: string;
  readonly stationName: string;
  readonly stationNumber: string;
  readonly waterName: string;
  readonly riverKm: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly distanceKm: string;
  readonly observedAt: string;
  readonly waterLevelCm: number;
  readonly unit: string;
  readonly stateMnwMhw: "LOW";
  readonly stateNswHsw: "NORMAL";
  readonly mhwCm: number;
  readonly hswCm: number;
  readonly hhwCm: number;
  readonly mnwCm: number;
  readonly mwCm: number;
  readonly markeICm: number;
  readonly markeIICm: number;
  readonly inspectionTriggerCm: number;
  readonly sourceDescription: string;
}

export interface HydrologyFloodEventFixture {
  readonly id: string;
  readonly externalStructureNumber: string;
  readonly eventYear: number;
  readonly peakedOn: string;
  readonly peakWaterLevelCm: number;
  readonly stationUuid: string;
  readonly stationName: string;
  readonly waterName: string;
  readonly mhwCm: number;
  readonly hswCm: number;
  readonly hhwCm: number;
  readonly markeICm: number;
  readonly markeIICm: number;
  readonly source: "WSV_PUBLISHED";
  readonly sourceDescription: string;
}

/**
 * Nearest PEGELONLINE gauge for Musterbrücke Fiktivtal (A57 / Millingen).
 * Current water level and characteristic values were fetched from the WSV
 * REST API on 2026-08-17. Historical Rhine peaks come from the published
 * Köln archive on the same waterway — PEGELONLINE REST only returns ~31 days.
 */
export const hydrologyMetricFixture: readonly HydrologyMetricFixture[] = [
  {
    id: "8a57d477-0001-4000-8000-000000000001",
    externalStructureNumber: "9999999",
    bridgeName: "Musterbrücke Fiktivtal",
    stationUuid: weselStation.uuid,
    stationName: weselStation.name,
    stationNumber: weselStation.number,
    waterName: weselStation.waterName,
    riverKm: weselStation.riverKm,
    latitude: weselStation.latitude,
    longitude: weselStation.longitude,
    distanceKm: "10.0",
    observedAt: "2026-08-17T15:15:00.000+02:00",
    waterLevelCm: 66,
    unit: "cm",
    stateMnwMhw: "LOW",
    stateNswHsw: "NORMAL",
    mhwCm: 804,
    hswCm: 1060,
    hhwCm: 1231,
    mnwCm: 144,
    mwCm: 348,
    markeICm: 870,
    markeIICm: 1060,
    inspectionTriggerCm: 804,
    sourceDescription:
      "PEGELONLINE Pegel Wesel (Rhein, km 814), fetched 2026-08-17. " +
      "Nearest federal gauge, 10 km from Musterbrücke. Fiktivbach has no WSV station; " +
      "Wesel is a regional Rhine flood signal, not a local stream gauge. " +
      "Inspection trigger = MHW 804 cm. hydrology-metrics-v1."
  }
];

const koelnArchive =
  "Published annual maximum at Pegel Köln (Rhein, km 688), Stadt Köln / DLRG Bezirk Köln Hochwasser archive. " +
  "Same federal waterway as Pegel Wesel. PEGELONLINE REST does not retain multi-year series.";

export const hydrologyFloodEventFixture: readonly HydrologyFloodEventFixture[] = [
  {
    id: "8a57d478-0001-4000-8000-000000000001",
    externalStructureNumber: "9999999",
    eventYear: 1995,
    peakedOn: "1995-01-23",
    peakWaterLevelCm: 1069,
    stationUuid: koelnStation.uuid,
    stationName: koelnStation.name,
    waterName: koelnStation.waterName,
    ...koelnThresholds,
    source: "WSV_PUBLISHED",
    sourceDescription: `${koelnArchive} January 1995 peak 10.69 m.`
  },
  {
    id: "8a57d478-0001-4000-8000-000000000002",
    externalStructureNumber: "9999999",
    eventYear: 2011,
    peakedOn: "2011-01-16",
    peakWaterLevelCm: 891,
    stationUuid: koelnStation.uuid,
    stationName: koelnStation.name,
    waterName: koelnStation.waterName,
    ...koelnThresholds,
    source: "WSV_PUBLISHED",
    sourceDescription: `${koelnArchive} January 2011 peak 8.91 m.`
  },
  {
    id: "8a57d478-0001-4000-8000-000000000003",
    externalStructureNumber: "9999999",
    eventYear: 2013,
    peakedOn: "2013-06-05",
    peakWaterLevelCm: 765,
    stationUuid: koelnStation.uuid,
    stationName: koelnStation.name,
    waterName: koelnStation.waterName,
    ...koelnThresholds,
    source: "WSV_PUBLISHED",
    sourceDescription: `${koelnArchive} June 2013 peak 7.65 m. Lower Rhine only moderately raised.`
  },
  {
    id: "8a57d478-0001-4000-8000-000000000004",
    externalStructureNumber: "9999999",
    eventYear: 2018,
    peakedOn: "2018-01-08",
    peakWaterLevelCm: 878,
    stationUuid: koelnStation.uuid,
    stationName: koelnStation.name,
    waterName: koelnStation.waterName,
    ...koelnThresholds,
    source: "WSV_PUBLISHED",
    sourceDescription: `${koelnArchive} 8 January 2018 peak 8.78 m.`
  },
  {
    id: "8a57d478-0001-4000-8000-000000000005",
    externalStructureNumber: "9999999",
    eventYear: 2021,
    peakedOn: "2021-02-07",
    peakWaterLevelCm: 869,
    stationUuid: koelnStation.uuid,
    stationName: koelnStation.name,
    waterName: koelnStation.waterName,
    ...koelnThresholds,
    source: "WSV_PUBLISHED",
    sourceDescription: `${koelnArchive} 7 February 2021 peak 8.69 m.`
  }
];
