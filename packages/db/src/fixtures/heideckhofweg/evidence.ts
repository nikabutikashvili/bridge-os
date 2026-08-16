import type {
  bridgeEvidence,
  componentEvidence,
  findingEvidence,
  historicalWorkEvidence,
  inspectionEvidence,
  partialStructureEvidence,
  recommendationEvidence,
  sourceEvidence,
  trafficObservationEvidence
} from "../../schema/index.js";
import { heideckhofwegFixtureTimestamp, heideckhofwegIds } from "./data.js";

type BridgeEvidenceInsert = typeof bridgeEvidence.$inferInsert;
type ComponentEvidenceInsert = typeof componentEvidence.$inferInsert;
type FindingEvidenceInsert = typeof findingEvidence.$inferInsert;
type HistoricalWorkEvidenceInsert = typeof historicalWorkEvidence.$inferInsert;
type InspectionEvidenceInsert = typeof inspectionEvidence.$inferInsert;
type PartialStructureEvidenceInsert = typeof partialStructureEvidence.$inferInsert;
type RecommendationEvidenceInsert = typeof recommendationEvidence.$inferInsert;
type SourceEvidenceInsert = typeof sourceEvidence.$inferInsert;
type TrafficObservationEvidenceInsert = typeof trafficObservationEvidence.$inferInsert;

export const heideckhofwegEvidenceIds = {
  identity: "44058840-0000-4000-8000-000000001001",
  geometry: "44058840-0000-4000-8000-000000001002",
  structure: "44058840-0000-4000-8000-000000001003",
  inspectionHistory: "44058840-0000-4000-8000-000000001004",
  traffic: "44058840-0000-4000-8000-000000001005",
  historicalCosts: "44058840-0000-4000-8000-000000001006",
  concreteCracking: "44058840-0000-4000-8000-000000001007",
  exposedReinforcement: "44058840-0000-4000-8000-000000001008",
  openCapJoint: "44058840-0000-4000-8000-000000001009",
  pavementJoint: "44058840-0000-4000-8000-000000001010",
  drainageBlister: "44058840-0000-4000-8000-000000001011",
  corrosionWeathering: "44058840-0000-4000-8000-000000001012",
  concreteRepair: "44058840-0000-4000-8000-000000001013",
  capJointSealing: "44058840-0000-4000-8000-000000001014",
  pavementJointRepair: "44058840-0000-4000-8000-000000001015",
  drainageRepair: "44058840-0000-4000-8000-000000001016",
  corrosionProtection: "44058840-0000-4000-8000-000000001017"
} as const;

const fixtureTimestamp = heideckhofwegFixtureTimestamp;
const structureBookId = heideckhofwegIds.documents.structureBook;
const inspectionReportId = heideckhofwegIds.documents.inspectionReport2023;

export const heideckhofwegEvidenceFixture = {
  sourceEvidence: [
    {
      id: heideckhofwegEvidenceIds.identity,
      documentId: structureBookId,
      pageNumber: 2,
      sourceExcerpt:
        "[DEMO-FIXTUR] Bauwerksnummer 9999999; Bauwerksname Musterbrücke Fiktivtal; Straße A57; nächster Ort Millingen.",
      boundingBoxX: "0.080000",
      boundingBoxY: "0.120000",
      boundingBoxWidth: "0.760000",
      boundingBoxHeight: "0.090000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.geometry,
      documentId: structureBookId,
      pageNumber: 4,
      sourceExcerpt:
        "[DEMO-FIXTUR] Baujahr 1983; Länge 7,23 m; Breite 14,75 m; Brückenfläche 117 m²; Anzahl Felder 1.",
      boundingBoxX: "0.090000",
      boundingBoxY: "0.300000",
      boundingBoxWidth: "0.740000",
      boundingBoxHeight: "0.120000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.structure,
      documentId: structureBookId,
      pageNumber: 5,
      sourceExcerpt:
        "[DEMO-FIXTUR] Bauwerksart Straßenbrücke; Tragwerk einfeldrige Stahlbeton-Vollplatte.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.inspectionHistory,
      documentId: structureBookId,
      pageNumber: 18,
      sourceExcerpt:
        "[DEMO-FIXTUR] Prüfungen: 2005 2,3; 2008 1,1; 2011 1,7; 2014 2,3; 2017 2,0; 2020 1,7; 2023 1,8.",
      boundingBoxX: "0.070000",
      boundingBoxY: "0.200000",
      boundingBoxWidth: "0.810000",
      boundingBoxHeight: "0.160000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.traffic,
      documentId: structureBookId,
      pageNumber: 11,
      sourceExcerpt:
        "[DEMO-FIXTUR] Straßenverkehrszählung 2015: DTV 41.878 Kfz/24h; Schwerverkehrsanteil 9,0 %.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.historicalCosts,
      documentId: structureBookId,
      pageNumber: 14,
      sourceExcerpt:
        "[DEMO-FIXTUR] Kostenübersicht: Neubau 1982–1983; Instandsetzung 2008; Belag und Abdichtung 2018.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.concreteCracking,
      documentId: inspectionReportId,
      pageNumber: 6,
      sourceExcerpt:
        "[DEMO-FIXTUR] S-001: Feine Netz- und Einzelrisse an der Überbauunterseite; Bewertung S1/V0/D2.",
      boundingBoxX: "0.080000",
      boundingBoxY: "0.180000",
      boundingBoxWidth: "0.720000",
      boundingBoxHeight: "0.100000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.exposedReinforcement,
      documentId: inspectionReportId,
      pageNumber: 7,
      sourceExcerpt:
        "[DEMO-FIXTUR] S-002: Betonabplatzung mit freiliegender, angerosteter Bewehrung am Widerlager; S1/V1/D3.",
      boundingBoxX: "0.090000",
      boundingBoxY: "0.250000",
      boundingBoxWidth: "0.760000",
      boundingBoxHeight: "0.120000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.openCapJoint,
      documentId: inspectionReportId,
      pageNumber: 8,
      sourceExcerpt: "[DEMO-FIXTUR] S-003: Kappenfuge offen; Bewertung S0/V1/D2.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.pavementJoint,
      documentId: inspectionReportId,
      pageNumber: 9,
      sourceExcerpt:
        "[DEMO-FIXTUR] S-004: Fahrbahnanschlüsse beidseitig schadhaft; Reparaturlänge insgesamt 30 m; S0/V2/D2.",
      boundingBoxX: "0.100000",
      boundingBoxY: "0.220000",
      boundingBoxWidth: "0.700000",
      boundingBoxHeight: "0.120000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.drainageBlister,
      documentId: inspectionReportId,
      pageNumber: 10,
      sourceExcerpt:
        "[DEMO-FIXTUR] S-005: Blasenbildung und Feuchtespuren im Bereich des östlichen Ablaufs; S0/V1/D2.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.corrosionWeathering,
      documentId: inspectionReportId,
      pageNumber: 11,
      sourceExcerpt:
        "[DEMO-FIXTUR] S-006: Beschichtung verwittert, lokale Korrosionsansätze an Geländerpfosten; S0/V1/D2.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.concreteRepair,
      documentId: inspectionReportId,
      pageNumber: 14,
      sourceExcerpt:
        "[DEMO-FIXTUR] Maßnahme M-001: Betoninstandsetzung mittelfristig; Kostenansatz 18.000 EUR.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.capJointSealing,
      documentId: inspectionReportId,
      pageNumber: 15,
      sourceExcerpt:
        "[DEMO-FIXTUR] Maßnahme M-002: Offene Kappenfuge mittelfristig schließen; Umfang 14,75 m; Kostenansatz nicht angegeben.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.pavementJointRepair,
      documentId: inspectionReportId,
      pageNumber: 16,
      sourceExcerpt:
        "[DEMO-FIXTUR] Maßnahme M-003: Fahrbahnanschlüsse mittelfristig auf 30 laufenden Metern erneuern; 24.000 EUR.",
      boundingBoxX: "0.080000",
      boundingBoxY: "0.320000",
      boundingBoxWidth: "0.780000",
      boundingBoxHeight: "0.110000",
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.drainageRepair,
      documentId: inspectionReportId,
      pageNumber: 17,
      sourceExcerpt:
        "[DEMO-FIXTUR] Maßnahme M-004: Abdichtung und Ablaufdetails mittelfristig instand setzen; 12.500 EUR.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegEvidenceIds.corrosionProtection,
      documentId: inspectionReportId,
      pageNumber: 18,
      sourceExcerpt:
        "[DEMO-FIXTUR] Maßnahme M-005: Korrosionsschutz auf 28 m mittelfristig erneuern; 16.000 EUR.",
      boundingBoxX: null,
      boundingBoxY: null,
      boundingBoxWidth: null,
      boundingBoxHeight: null,
      extractionConfidence: null,
      extractionMethod: "IMPORT",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies SourceEvidenceInsert[],
  bridgeEvidence: [
    "externalStructureNumber",
    "name",
    "road",
    "location.municipality",
    "location.locality",
    "location.crossedFeature"
  ].map(
    (fieldName) =>
      ({
        bridgeId: heideckhofwegIds.bridge,
        evidenceId: heideckhofwegEvidenceIds.identity,
        fieldName,
        kind: "SOURCE_FACT",
        derivationMethod: null,
        createdAt: fixtureTimestamp
      }) satisfies BridgeEvidenceInsert
  ),
  partialStructureEvidence: [
    ...["constructionYear", "lengthM", "widthM", "areaSqM", "spanCount"].map(
      (fieldName) =>
        ({
          partialStructureId: heideckhofwegIds.partialStructure,
          evidenceId: heideckhofwegEvidenceIds.geometry,
          fieldName,
          kind: "SOURCE_FACT",
          derivationMethod: null,
          createdAt: fixtureTimestamp
        }) satisfies PartialStructureEvidenceInsert
    ),
    ...["structureType", "structuralSystem"].map(
      (fieldName) =>
        ({
          partialStructureId: heideckhofwegIds.partialStructure,
          evidenceId: heideckhofwegEvidenceIds.structure,
          fieldName,
          kind: "SOURCE_FACT",
          derivationMethod: null,
          createdAt: fixtureTimestamp
        }) satisfies PartialStructureEvidenceInsert
    )
  ] satisfies PartialStructureEvidenceInsert[],
  componentEvidence: ["type", "material"].map(
    (fieldName) =>
      ({
        componentId: heideckhofwegIds.components.superstructure,
        evidenceId: heideckhofwegEvidenceIds.structure,
        fieldName,
        kind: "SOURCE_FACT",
        derivationMethod: null,
        createdAt: fixtureTimestamp
      }) satisfies ComponentEvidenceInsert
  ),
  inspectionEvidence: Object.values(heideckhofwegIds.inspections).flatMap((inspectionId) =>
    ["type", "inspectedOn", "conditionScore"].map(
      (fieldName) =>
        ({
          inspectionId,
          evidenceId: heideckhofwegEvidenceIds.inspectionHistory,
          fieldName,
          kind: "SOURCE_FACT",
          derivationMethod: null,
          createdAt: fixtureTimestamp
        }) satisfies InspectionEvidenceInsert
    )
  ),
  findingEvidence: [
    ...[
      {
        findingId: heideckhofwegIds.findings.concreteCracking,
        evidenceId: heideckhofwegEvidenceIds.concreteCracking
      },
      {
        findingId: heideckhofwegIds.findings.exposedReinforcement,
        evidenceId: heideckhofwegEvidenceIds.exposedReinforcement
      },
      {
        findingId: heideckhofwegIds.findings.openCapJoint,
        evidenceId: heideckhofwegEvidenceIds.openCapJoint
      },
      {
        findingId: heideckhofwegIds.findings.pavementJoint,
        evidenceId: heideckhofwegEvidenceIds.pavementJoint
      },
      {
        findingId: heideckhofwegIds.findings.drainageBlister,
        evidenceId: heideckhofwegEvidenceIds.drainageBlister
      },
      {
        findingId: heideckhofwegIds.findings.corrosionWeathering,
        evidenceId: heideckhofwegEvidenceIds.corrosionWeathering
      }
    ].flatMap(({ evidenceId, findingId }) =>
      [
        "sourceIdentifier",
        "description",
        "stabilityRating",
        "trafficSafetyRating",
        "durabilityRating"
      ].map(
        (fieldName) =>
          ({
            findingId,
            evidenceId,
            fieldName,
            kind: "SOURCE_FACT",
            derivationMethod: null,
            createdAt: fixtureTimestamp
          }) satisfies FindingEvidenceInsert
      )
    ),
    ...["quantity", "quantityUnit"].map(
      (fieldName) =>
        ({
          findingId: heideckhofwegIds.findings.pavementJoint,
          evidenceId: heideckhofwegEvidenceIds.pavementJoint,
          fieldName,
          kind: "SOURCE_FACT",
          derivationMethod: null,
          createdAt: fixtureTimestamp
        }) satisfies FindingEvidenceInsert
    )
  ] satisfies FindingEvidenceInsert[],
  recommendationEvidence: [
    {
      recommendationId: heideckhofwegIds.recommendations.concreteRepair,
      evidenceId: heideckhofwegEvidenceIds.concreteRepair
    },
    {
      recommendationId: heideckhofwegIds.recommendations.capJointSealing,
      evidenceId: heideckhofwegEvidenceIds.capJointSealing
    },
    {
      recommendationId: heideckhofwegIds.recommendations.pavementJointRepair,
      evidenceId: heideckhofwegEvidenceIds.pavementJointRepair
    },
    {
      recommendationId: heideckhofwegIds.recommendations.drainageRepair,
      evidenceId: heideckhofwegEvidenceIds.drainageRepair
    },
    {
      recommendationId: heideckhofwegIds.recommendations.corrosionProtection,
      evidenceId: heideckhofwegEvidenceIds.corrosionProtection
    }
  ].flatMap(({ evidenceId, recommendationId }) =>
    ["description", "urgency", "quantity", "unit", "sourceEstimatedCost", "targetYear"].map(
      (fieldName) =>
        ({
          recommendationId,
          evidenceId,
          fieldName,
          kind: "SOURCE_FACT",
          derivationMethod: null,
          createdAt: fixtureTimestamp
        }) satisfies RecommendationEvidenceInsert
    )
  ),
  historicalWorkEvidence: Object.values(heideckhofwegIds.historicalWorks).flatMap(
    (historicalWorkId) =>
      ["title", "startedOn", "endedOn", "contractAmount", "finalAmount", "currency"].map(
        (fieldName) =>
          ({
            historicalWorkId,
            evidenceId: heideckhofwegEvidenceIds.historicalCosts,
            fieldName,
            kind: "SOURCE_FACT",
            derivationMethod: null,
            createdAt: fixtureTimestamp
          }) satisfies HistoricalWorkEvidenceInsert
      )
  ),
  trafficObservationEvidence: ["observationYear", "dailyTraffic", "truckSharePercent"].map(
    (fieldName) =>
      ({
        trafficObservationId: heideckhofwegIds.traffic2015,
        evidenceId: heideckhofwegEvidenceIds.traffic,
        fieldName,
        kind: "SOURCE_FACT",
        derivationMethod: null,
        createdAt: fixtureTimestamp
      }) satisfies TrafficObservationEvidenceInsert
  )
} as const;
