import { describe, expect, it } from "vitest";

import {
  bridgeDataOriginSchema,
  createDocumentSchema,
  createEnvironmentalMetricSchema,
  createNetworkMetricSchema,
  createFindingSchema,
  createHistoricalWorkSchema,
  createInspectionSchema,
  createPlannedInterventionSchema,
  createRecommendationSchema,
  createSourceEvidenceSchema,
  createTrafficObservationSchema,
  findingProvenanceLinkSchema
} from "../src/index.js";

const bridgeId = "e78c44f1-b817-4854-95da-427032fe5316";
const partialStructureId = "bc4b7532-780b-4402-ae3a-125c3d662eeb";
const inspectionId = "36ac9061-e754-4c20-837d-186b6ae34569";
const evidenceId = "fc4a0634-fe53-4ba7-ae11-b9c370341ebe";

describe("bridge contracts", () => {
  it("distinguishes demo fixtures from extracted and user-entered aggregates", () => {
    expect(bridgeDataOriginSchema.safeParse("DEMO_FIXTURE").success).toBe(true);
    expect(bridgeDataOriginSchema.safeParse("PDF_IMPORT").success).toBe(false);
  });
});

const findingInput = {
  bridgeId,
  partialStructureId,
  inspectionId,
  componentId: null,
  sourceIdentifier: "S-001",
  defectType: "Riss",
  description: "Riss an der Unterseite",
  location: null,
  extent: null,
  dimensionLength: "1.250",
  dimensionWidth: null,
  dimensionDepth: null,
  dimensionUnit: "m",
  quantity: null,
  quantityUnit: null,
  stabilityRating: 1,
  trafficSafetyRating: 0,
  durabilityRating: 2,
  status: "OPEN"
} as const;

describe("inspection contracts", () => {
  it("enforces DIN condition score bounds and known inspection types", () => {
    const base = {
      bridgeId,
      partialStructureId,
      type: "MAIN",
      inspectedOn: "2026-05-12",
      inspector: null,
      conditionScore: "2.3",
      cycleMonths: 72
    };

    expect(createInspectionSchema.safeParse(base).success).toBe(true);
    expect(createInspectionSchema.safeParse({ ...base, conditionScore: "4.1" }).success).toBe(
      false
    );
    expect(createInspectionSchema.safeParse({ ...base, type: "ROUTINE" }).success).toBe(false);
  });
});

describe("finding and recommendation contracts", () => {
  it("requires units for measured finding values and constrains S/V/D", () => {
    expect(createFindingSchema.safeParse(findingInput).success).toBe(true);
    expect(
      createFindingSchema.safeParse({ ...findingInput, dimensionUnit: null }).success
    ).toBe(false);
    expect(
      createFindingSchema.safeParse({ ...findingInput, stabilityRating: 5 }).success
    ).toBe(false);
  });

  it("keeps decimal money paired with a currency", () => {
    const recommendation = {
      bridgeId,
      partialStructureId,
      workType: "Betoninstandsetzung",
      description: "Riss schließen",
      urgency: "kurzfristig",
      quantity: "12.500",
      unit: "m",
      sourceEstimatedCost: "18000.00",
      sourceEstimatedCostCurrency: "EUR",
      targetYear: 2027,
      plannedYear: null,
      status: "OPEN"
    };

    expect(createRecommendationSchema.safeParse(recommendation).success).toBe(true);
    expect(
      createRecommendationSchema.safeParse({
        ...recommendation,
        sourceEstimatedCostCurrency: null
      }).success
    ).toBe(false);
  });
});

describe("planned intervention contracts", () => {
  it("requires an explicit managerial work type and planned year", () => {
    const intervention = {
      recommendationId: inspectionId,
      workType: "Erneuerung der Fahrbahnanschlüsse",
      plannedYear: 2027,
      quantity: { value: "30.000", unit: "m" },
      estimatedCost: { amount: "28000.00", currency: "EUR" }
    };

    expect(createPlannedInterventionSchema.safeParse(intervention).success).toBe(true);
    expect(
      createPlannedInterventionSchema.safeParse({
        ...intervention,
        workType: "   "
      }).success
    ).toBe(false);
    expect(
      createPlannedInterventionSchema.safeParse({
        ...intervention,
        plannedYear: 1699
      }).success
    ).toBe(false);
  });

  it("keeps quantities and managerial cost estimates structured", () => {
    expect(
      createPlannedInterventionSchema.safeParse({
        recommendationId: inspectionId,
        workType: "Fugeninstandsetzung",
        plannedYear: 2027,
        quantity: { value: "-1", unit: "m" },
        estimatedCost: null
      }).success
    ).toBe(false);
    expect(
      createPlannedInterventionSchema.safeParse({
        recommendationId: inspectionId,
        workType: "Fugeninstandsetzung",
        plannedYear: 2027,
        quantity: null,
        estimatedCost: { amount: "9500.00", currency: "eur" }
      }).success
    ).toBe(false);
  });
});

describe("historical and traffic contracts", () => {
  it("rejects reversed work dates", () => {
    const result = createHistoricalWorkSchema.safeParse({
      bridgeId,
      partialStructureId: null,
      type: null,
      title: "Kappenerneuerung",
      reason: null,
      contractor: null,
      client: null,
      startedOn: "2024-10-02",
      endedOn: "2024-09-01",
      quantity: null,
      unit: null,
      contractAmount: null,
      finalAmount: null,
      currency: null
    });

    expect(result.success).toBe(false);
  });

  it("requires an observation date to match its stated year", () => {
    const result = createTrafficObservationSchema.safeParse({
      bridgeId,
      observationYear: 2025,
      observedOn: "2024-08-01",
      dailyTraffic: 42_000,
      heavyVehicleDaily: 5_964,
      truckSharePercent: "14.20",
      source: "DOCUMENT",
      sourceDescription: null
    });

    expect(result.success).toBe(false);
  });
});

describe("environmental metric contracts", () => {
  it("requires twelve monthly values when climate series are present", () => {
    const base = {
      bridgeId,
      observationYear: 2025,
      latitude: "51.558719",
      longitude: "6.552642",
      gridLatitude: "51.564144",
      gridLongitude: "6.533575",
      elevationM: "27.0",
      freezeThawDays: 53,
      frostDays: 54,
      iceDays: 1,
      wetDryCycles: 48,
      meanRelativeHumidityPercent: "78.1",
      precipitationHours: 1435,
      heavyRainDays20: 3,
      heavyRainDays30: 0,
      annualPrecipMm: "738.5",
      deicingDays: 30,
      source: "OPEN_METEO" as const,
      sourceDescription: "Open-Meteo Historical Weather (ERA5-land)",
      formulaVersion: "weather-metrics-v1"
    };

    expect(
      createEnvironmentalMetricSchema.safeParse({
        ...base,
        monthlyPrecipMm: null,
        monthlyFreezeThawDays: null
      }).success
    ).toBe(true);

    expect(
      createEnvironmentalMetricSchema.safeParse({
        ...base,
        monthlyPrecipMm: [1, 2, 3],
        monthlyFreezeThawDays: null
      }).success
    ).toBe(false);
  });
});

describe("network metric contracts", () => {
  it("stores a closure-impact snapshot with road class and distances", () => {
    expect(
      createNetworkMetricSchema.safeParse({
        bridgeId,
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
        source: "OSM_ROUTED",
        sourceDescription: "Offline OSM route with the crossing excluded.",
        formulaVersion: "closure-impact-v1"
      }).success
    ).toBe(true);
  });
});

describe("document provenance contracts", () => {
  it("does not allow partial-structure assignment without a bridge", () => {
    const result = createDocumentSchema.safeParse({
      bridgeId: null,
      partialStructureId,
      type: "BAUWERKSBUCH",
      originalFilename: "bauwerksbuch.pdf",
      status: "UPLOADED",
      metadata: null
    });

    expect(result.success).toBe(false);
  });

  it("requires a page for normalized bounding boxes", () => {
    const result = createSourceEvidenceSchema.safeParse({
      documentId: evidenceId,
      extractionRunId: null,
      pageNumber: null,
      sourceExcerpt: "Zustandsnote 2,3",
      boundingBox: { x: "0.1", y: "0.2", width: "0.3", height: "0.1" },
      extractionConfidence: "0.970",
      extractionMethod: "MODEL_EXTRACTION",
      reviewState: "AUTOMATICALLY_EXTRACTED"
    });

    expect(result.success).toBe(false);
  });

  it("requires review state for run-created evidence only", () => {
    const base = {
      documentId: evidenceId,
      extractionRunId: inspectionId,
      pageNumber: 1,
      sourceExcerpt: "Zustandsnote 1,8",
      boundingBox: null,
      extractionConfidence: "0.950",
      extractionMethod: "MODEL_EXTRACTION" as const,
      reviewState: null
    };

    expect(createSourceEvidenceSchema.safeParse(base).success).toBe(false);
    expect(
      createSourceEvidenceSchema.safeParse({
        ...base,
        reviewState: "AUTOMATICALLY_EXTRACTED"
      }).success
    ).toBe(true);
    expect(
      createSourceEvidenceSchema.safeParse({
        ...base,
        extractionMethod: "IMPORT",
        extractionRunId: null,
        reviewState: "AUTOMATICALLY_EXTRACTED"
      }).success
    ).toBe(false);
  });

  it("distinguishes source facts from explained derived values", () => {
    const sourceFact = {
      entityId: inspectionId,
      evidenceId,
      fieldName: "description",
      kind: "SOURCE_FACT",
      derivationMethod: null
    };

    expect(findingProvenanceLinkSchema.safeParse(sourceFact).success).toBe(true);
    expect(
      findingProvenanceLinkSchema.safeParse({
        ...sourceFact,
        kind: "DERIVED",
        derivationMethod: null
      }).success
    ).toBe(false);
    expect(
      findingProvenanceLinkSchema.safeParse({ ...sourceFact, fieldName: "conditionScore" })
        .success
    ).toBe(false);
  });
});
