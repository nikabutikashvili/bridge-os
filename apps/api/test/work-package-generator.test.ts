import type { WorkPackageSnapshot } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import {
  generateWorkPackage,
  type WorkPackageGenerationInput
} from "../src/features/work-packages/generator.js";

describe("work package generation", () => {
  it("snapshots planning scope without promoting unsupported operational facts", () => {
    const generated = generateWorkPackage(input());

    expect(generated.title).toBe("Joint repair · 4405884");
    expect(generated.snapshot).toMatchObject({
      version: 1,
      disclaimer: "Planning draft — requires technical and procurement review.",
      scope: {
        quantity: { value: "30.000", unit: "m" },
        quantitySource: "PLANNED_INTERVENTION"
      },
      operationalContext: {
        inspectionAccessEquipment: null,
        knownConstraints: [],
        trafficManagementRequirements: null
      },
      commercialPlanning: {
        planningEstimate: { amount: "28000.00", currency: "EUR" },
        estimateSource: "USER_PLANNING",
        sourceRecommendationEstimate: { amount: "24000.00", currency: "EUR" }
      }
    });
  });

  it("does not use a recommendation estimate as the planning estimate", () => {
    const base = input();
    const generated = generateWorkPackage({
      ...base,
      intervention: {
        ...base.intervention,
        planningEstimate: null,
        estimateSource: null,
        estimateStatus: null
      }
    });

    expect(generated.snapshot.commercialPlanning.planningEstimate).toBeNull();
    expect(
      generated.snapshot.readiness.find(
        (item) => item.code === "COST_ESTIMATE_AVAILABLE"
      )?.state
    ).toBe("MISSING");
  });

  it("falls back to a source quantity while preserving its origin", () => {
    const base = input();
    const generated = generateWorkPackage({
      ...base,
      intervention: { ...base.intervention, quantity: null }
    });

    expect(generated.snapshot.scope.quantity).toEqual({
      value: "30.000",
      unit: "m"
    });
    expect(generated.snapshot.scope.quantitySource).toBe("SOURCE_RECOMMENDATION");
  });
});

function input(): WorkPackageGenerationInput {
  const bridgeId = "44058840-0000-4000-8000-000000000001";
  const partialStructureId = "44058840-0000-4000-8000-000000000002";
  const interventionId = "44058840-0000-4000-8000-000000000703";
  const recommendationId = "44058840-0000-4000-8000-000000000403";
  const inspectionId = "44058840-0000-4000-8000-000000000207";
  const componentId = "44058840-0000-4000-8000-000000000107";
  const findingId = "44058840-0000-4000-8000-000000000304";
  const evidenceId = "44058840-0000-4000-8000-000000001015";
  const documentId = "44058840-0000-4000-8000-000000000902";
  const inspection: WorkPackageSnapshot["evidence"]["sourceInspections"][number] = {
    id: inspectionId,
    type: "MAIN",
    inspectedOn: "2023-05-23",
    inspector: null,
    conditionScore: "1.8"
  };
  return {
    generatedAt: "2026-08-15T12:00:00.000Z",
    asset: {
      bridge: {
        id: bridgeId,
        externalStructureNumber: "4405884",
        name: "Heideckhofweg",
        road: "A57",
        location: {
          federalState: "Nordrhein-Westfalen",
          district: "Wesel",
          municipality: "Rheinberg",
          locality: "Millingen",
          crossedFeature: "Heideckhofweg"
        },
        responsibleAuthority: "Autobahnverwaltung (Demo)",
        maintenanceOffice: "Autobahnmeisterei Niederrhein (Demo)"
      },
      partialStructure: {
        id: partialStructureId,
        externalNumber: "1",
        name: "Teilbauwerk 1"
      }
    },
    intervention: {
      id: interventionId,
      workType: "Joint repair",
      plannedYear: 2026,
      quantity: { value: "30.000", unit: "m" },
      planningEstimate: { amount: "28000.00", currency: "EUR" },
      estimateSource: "USER_PLANNING",
      estimateStatus: "DRAFT"
    },
    recommendation: {
      id: recommendationId,
      description: "Renew pavement joints.",
      urgency: "MITTELFRISTIG",
      quantity: { value: "30.000", unit: "m" },
      sourceEstimatedCost: { amount: "24000.00", currency: "EUR" }
    },
    components: [
      {
        id: componentId,
        type: "FAHRBAHNUEBERGANG",
        name: "Fahrbahnanschlüsse",
        location: "Beide Brückenenden",
        material: "Asphalt und Stahl",
        constructionYear: null,
        installYear: 2018,
        additionalProperties: { totalRepairLengthM: 30 }
      }
    ],
    findings: [
      {
        id: findingId,
        sourceIdentifier: "DEMO-S-2023-004",
        defectType: "Schadhafter Fahrbahnanschluss",
        description: "Rissiger Fahrbahnanschluss.",
        location: "Nord und Süd",
        extent: "Beide Übergangsbereiche",
        quantity: { value: "30.000", unit: "m" },
        ratings: { stability: 0, trafficSafety: 2, durability: 2 },
        status: "OPEN",
        componentId,
        inspectionId
      }
    ],
    sourceInspections: [inspection],
    latestInspection: { ...inspection, dueStatus: "CURRENT" },
    traffic: {
      observationYear: 2015,
      observedOn: "2015-01-01",
      dailyTraffic: 41878,
      heavyVehicleDaily: 3769,
      truckSharePercent: "9.00"
    },
    citations: [
      {
        entityType: "RECOMMENDATION",
        entityId: recommendationId,
        citation: {
          evidenceId,
          documentId,
          documentType: "DEMO_PRUEFBERICHT",
          originalFilename: "DEMO_Hauptpruefung_4405884_2023.pdf",
          pageNumber: 16,
          excerpt: "[DEMO-FIXTUR] Maßnahme M-003.",
          boundingBox: null,
          extractionConfidence: null,
          extractionMethod: "IMPORT",
          reviewState: null,
          fieldName: "description",
          kind: "SOURCE_FACT",
          derivationMethod: null,
          viewSourceUrl: null
        }
      }
    ],
    documents: [
      {
        id: documentId,
        type: "DEMO_PRUEFBERICHT",
        originalFilename: "DEMO_Hauptpruefung_4405884_2023.pdf",
        status: "READY",
        evidencePages: [16],
        isDrawing: false,
        isPhoto: false,
        viewSourceUrl: null
      }
    ],
    technicalContext: {
      constructionYear: 1983,
      structureType: "Straßenbrücke",
      structuralSystem: "Einfeldrige Stahlbeton-Vollplatte",
      dimensions: {
        lengthM: "7.230",
        widthM: "14.750",
        areaSqM: "117.000",
        clearHeightM: null,
        spanCount: 1
      }
    },
    inspectionAccessEquipment: null,
    knownConstraints: [],
    trafficManagementRequirements: null
  };
}
