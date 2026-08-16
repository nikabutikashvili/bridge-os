import type {
  bridges,
  budgetProgramInterventions,
  budgetPrograms,
  components,
  documents,
  findings,
  historicalWorks,
  inspections,
  partialStructures,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  trafficObservations
} from "../../schema/index.js";

type BridgeInsert = typeof bridges.$inferInsert;
type BudgetProgramInsert = typeof budgetPrograms.$inferInsert;
type BudgetProgramInterventionInsert =
  typeof budgetProgramInterventions.$inferInsert;
type ComponentInsert = typeof components.$inferInsert;
type DocumentInsert = typeof documents.$inferInsert;
type FindingInsert = typeof findings.$inferInsert;
type HistoricalWorkInsert = typeof historicalWorks.$inferInsert;
type InspectionInsert = typeof inspections.$inferInsert;
type PartialStructureInsert = typeof partialStructures.$inferInsert;
type PlannedInterventionInsert = typeof plannedInterventions.$inferInsert;
type RecommendationFindingInsert = typeof recommendationFindings.$inferInsert;
type RecommendationInsert = typeof recommendations.$inferInsert;
type TrafficObservationInsert = typeof trafficObservations.$inferInsert;

export const heideckhofwegFixtureTimestamp = new Date("2026-08-14T12:00:00.000Z");
const fixtureTimestamp = heideckhofwegFixtureTimestamp;

export const heideckhofwegIds = {
  bridge: "44058840-0000-4000-8000-000000000001",
  partialStructure: "44058840-0000-4000-8000-000000000002",
  components: {
    superstructure: "44058840-0000-4000-8000-000000000101",
    abutments: "44058840-0000-4000-8000-000000000102",
    caps: "44058840-0000-4000-8000-000000000103",
    pavement: "44058840-0000-4000-8000-000000000104",
    drainageAndWaterproofing: "44058840-0000-4000-8000-000000000105",
    safetyEquipment: "44058840-0000-4000-8000-000000000106",
    pavementJoint: "44058840-0000-4000-8000-000000000107"
  },
  inspections: {
    main2005: "44058840-0000-4000-8000-000000000201",
    simple2008: "44058840-0000-4000-8000-000000000202",
    main2011: "44058840-0000-4000-8000-000000000203",
    simple2014: "44058840-0000-4000-8000-000000000204",
    main2017: "44058840-0000-4000-8000-000000000205",
    simple2020: "44058840-0000-4000-8000-000000000206",
    main2023: "44058840-0000-4000-8000-000000000207"
  },
  findings: {
    concreteCracking: "44058840-0000-4000-8000-000000000301",
    exposedReinforcement: "44058840-0000-4000-8000-000000000302",
    openCapJoint: "44058840-0000-4000-8000-000000000303",
    pavementJoint: "44058840-0000-4000-8000-000000000304",
    drainageBlister: "44058840-0000-4000-8000-000000000305",
    corrosionWeathering: "44058840-0000-4000-8000-000000000306"
  },
  recommendations: {
    concreteRepair: "44058840-0000-4000-8000-000000000401",
    capJointSealing: "44058840-0000-4000-8000-000000000402",
    pavementJointRepair: "44058840-0000-4000-8000-000000000403",
    drainageRepair: "44058840-0000-4000-8000-000000000404",
    corrosionProtection: "44058840-0000-4000-8000-000000000405"
  },
  plannedInterventions: {
    concreteRepair: "44058840-0000-4000-8000-000000000701",
    capJointSealing: "44058840-0000-4000-8000-000000000702",
    pavementJointRepair: "44058840-0000-4000-8000-000000000703"
  },
  budgetProgram2026: "44058840-0000-4000-8000-000000000801",
  historicalWorks: {
    originalConstruction: "44058840-0000-4000-8000-000000000501",
    concreteMaintenance: "44058840-0000-4000-8000-000000000502",
    pavementRenewal: "44058840-0000-4000-8000-000000000503"
  },
  traffic2015: "44058840-0000-4000-8000-000000000601",
  documents: {
    structureBook: "44058840-0000-4000-8000-000000000901",
    inspectionReport2023: "44058840-0000-4000-8000-000000000902"
  }
} as const;

const bridgeScope = {
  bridgeId: heideckhofwegIds.bridge,
  partialStructureId: heideckhofwegIds.partialStructure
} as const;

export const heideckhofwegFixture = {
  bridge: {
    id: heideckhofwegIds.bridge,
    externalStructureNumber: "9999999",
    name: "Musterbrücke Fiktivtal",
    road: "A57",
    countryCode: "DE",
    federalState: "Nordrhein-Westfalen",
    district: "Wesel",
    municipality: "Rheinberg",
    locality: "Millingen",
    postalCode: null,
    stationing: null,
    crossedFeature: "Fiktivbach",
    latitude: null,
    longitude: null,
    owner: "Bundesrepublik Deutschland (Demo)",
    loadBearingResponsibility: "Bundesfernstraße (Demo)",
    responsibleAuthority: "Autobahnverwaltung (Demo)",
    maintenanceOffice: "Autobahnmeisterei Niederrhein (Demo)",
    dataOrigin: "DEMO_FIXTURE",
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp
  } satisfies BridgeInsert,
  partialStructure: {
    id: heideckhofwegIds.partialStructure,
    bridgeId: heideckhofwegIds.bridge,
    externalPartialStructureNumber: "1",
    name: "Musterbrücke Fiktivtal - Teilbauwerk 1 (Demo)",
    constructionYear: 1983,
    structureType: "Straßenbrücke",
    structuralSystem: "Einfeldrige Stahlbeton-Vollplatte",
    lengthM: "7.230",
    widthM: "14.750",
    areaSqM: "117.000",
    clearHeightM: null,
    spanCount: 1,
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp
  } satisfies PartialStructureInsert,
  components: [
    {
      id: heideckhofwegIds.components.superstructure,
      ...bridgeScope,
      type: "UEBERBAU",
      name: "Überbau",
      location: "Gesamtes Teilbauwerk",
      material: "Stahlbeton",
      constructionYear: 1983,
      installYear: 1983,
      additionalProperties: { structuralForm: "Vollplatte" },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.abutments,
      ...bridgeScope,
      type: "WIDERLAGER",
      name: "Widerlager Nord und Süd",
      location: "Beide Brückenenden",
      material: "Stahlbeton",
      constructionYear: 1983,
      installYear: 1983,
      additionalProperties: null,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.caps,
      ...bridgeScope,
      type: "KAPPEN",
      name: "Randkappen",
      location: "West- und Ostseite",
      material: "Stahlbeton",
      constructionYear: 1983,
      installYear: 1983,
      additionalProperties: null,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.pavement,
      ...bridgeScope,
      type: "BELAG",
      name: "Fahrbahnbelag",
      location: "Fahrbahnfläche",
      material: "Asphalt",
      constructionYear: null,
      installYear: 2018,
      additionalProperties: { areaSqM: 117 },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.drainageAndWaterproofing,
      ...bridgeScope,
      type: "ABDICHTUNG_ENTWAESSERUNG",
      name: "Abdichtung und Entwässerung",
      location: "Unter Fahrbahnbelag und an den Abläufen",
      material: null,
      constructionYear: null,
      installYear: 2018,
      additionalProperties: { drainageOutlets: 2 },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.safetyEquipment,
      ...bridgeScope,
      type: "SCHUTZEINRICHTUNG",
      name: "Geländer und Schutzeinrichtungen",
      location: "Beide Brückenseiten",
      material: "Stahl, beschichtet",
      constructionYear: null,
      installYear: 1983,
      additionalProperties: null,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.components.pavementJoint,
      ...bridgeScope,
      type: "FAHRBAHNUEBERGANG",
      name: "Fahrbahnanschlüsse und Übergangskonstruktionen",
      location: "Beide Brückenenden",
      material: "Asphalt und Stahl",
      constructionYear: null,
      installYear: 2018,
      additionalProperties: { totalRepairLengthM: 30 },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies ComponentInsert[],
  inspections: [
    {
      id: heideckhofwegIds.inspections.main2005,
      ...bridgeScope,
      type: "MAIN",
      inspectedOn: "2005-05-12",
      inspector: null,
      conditionScore: "2.3",
      cycleMonths: 72,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.simple2008,
      ...bridgeScope,
      type: "SIMPLE",
      inspectedOn: "2008-05-15",
      inspector: null,
      conditionScore: "1.1",
      cycleMonths: 36,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.main2011,
      ...bridgeScope,
      type: "MAIN",
      inspectedOn: "2011-05-17",
      inspector: null,
      conditionScore: "1.7",
      cycleMonths: 72,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.simple2014,
      ...bridgeScope,
      type: "SIMPLE",
      inspectedOn: "2014-05-20",
      inspector: null,
      conditionScore: "2.3",
      cycleMonths: 36,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.main2017,
      ...bridgeScope,
      type: "MAIN",
      inspectedOn: "2017-05-18",
      inspector: null,
      conditionScore: "2.0",
      cycleMonths: 72,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.simple2020,
      ...bridgeScope,
      type: "SIMPLE",
      inspectedOn: "2020-05-19",
      inspector: null,
      conditionScore: "1.7",
      cycleMonths: 36,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.inspections.main2023,
      ...bridgeScope,
      type: "MAIN",
      inspectedOn: "2023-05-23",
      inspector: null,
      conditionScore: "1.8",
      cycleMonths: 72,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies InspectionInsert[],
  findings: [
    {
      id: heideckhofwegIds.findings.concreteCracking,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.superstructure,
      sourceIdentifier: "DEMO-S-2023-001",
      defectType: "Betonriss",
      description: "Feine Netz- und Einzelrisse an der Unterseite des Überbaus.",
      location: "Überbauunterseite, westliches Drittel",
      extent: "Mehrere lokale Rissbereiche",
      dimensionLength: "2.400",
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: "m",
      quantity: null,
      quantityUnit: null,
      stabilityRating: 1,
      trafficSafetyRating: 0,
      durabilityRating: 2,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.findings.exposedReinforcement,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.abutments,
      sourceIdentifier: "DEMO-S-2023-002",
      defectType: "Betonabplatzung / freiliegende Bewehrung",
      description: "Lokale Betonabplatzung mit freiliegender, angerosteter Bewehrung.",
      location: "Widerlager Nord, Stirnfläche",
      extent: "Lokale Schadstelle",
      dimensionLength: null,
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: null,
      quantity: "0.800",
      quantityUnit: "m²",
      stabilityRating: 1,
      trafficSafetyRating: 1,
      durabilityRating: 3,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.findings.openCapJoint,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.caps,
      sourceIdentifier: "DEMO-S-2023-003",
      defectType: "Offene Kappenfuge",
      description: "Kappenfuge offen; Feuchtigkeit kann in den Fugenbereich eindringen.",
      location: "Randkappe Ost, nördlicher Anschluss",
      extent: "Durchgehend über die Kappenbreite",
      dimensionLength: "14.750",
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: "m",
      quantity: null,
      quantityUnit: null,
      stabilityRating: 0,
      trafficSafetyRating: 1,
      durabilityRating: 2,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.findings.pavementJoint,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.pavementJoint,
      sourceIdentifier: "DEMO-S-2023-004",
      defectType: "Schadhafter Fahrbahnanschluss",
      description: "Rissiger und stellenweise ausgebrochener Fahrbahnanschluss an beiden Brückenenden.",
      location: "Fahrbahnübergänge Nord und Süd",
      extent: "Beide Übergangsbereiche",
      dimensionLength: null,
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: null,
      quantity: "30.000",
      quantityUnit: "m",
      stabilityRating: 0,
      trafficSafetyRating: 2,
      durabilityRating: 2,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.findings.drainageBlister,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.drainageAndWaterproofing,
      sourceIdentifier: "DEMO-S-2023-005",
      defectType: "Blasenbildung / Entwässerungsmangel",
      description: "Blasenbildung im Belag und Feuchtespuren im Bereich des östlichen Ablaufs.",
      location: "Fahrbahn Ostseite am Ablauf",
      extent: "Zwei lokale Bereiche",
      dimensionLength: null,
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: null,
      quantity: "4.000",
      quantityUnit: "m²",
      stabilityRating: 0,
      trafficSafetyRating: 1,
      durabilityRating: 2,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.findings.corrosionWeathering,
      ...bridgeScope,
      inspectionId: heideckhofwegIds.inspections.main2023,
      componentId: heideckhofwegIds.components.safetyEquipment,
      sourceIdentifier: "DEMO-S-2023-006",
      defectType: "Korrosion / Verwitterung",
      description: "Beschichtung verwittert; lokale Korrosionsansätze an Geländerpfosten und Fußplatten.",
      location: "Geländer beidseitig",
      extent: "Mehrere Pfosten über die Bauwerkslänge",
      dimensionLength: null,
      dimensionWidth: null,
      dimensionDepth: null,
      dimensionUnit: null,
      quantity: "28.000",
      quantityUnit: "m",
      stabilityRating: 0,
      trafficSafetyRating: 1,
      durabilityRating: 2,
      status: "MONITORING",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies FindingInsert[],
  recommendations: [
    {
      id: heideckhofwegIds.recommendations.concreteRepair,
      ...bridgeScope,
      workType: "BETONINSTANDSETZUNG",
      description: "Risse schließen, lose Bereiche abtragen, Bewehrung entrosten und Betonersatz herstellen.",
      urgency: "MITTELFRISTIG",
      quantity: "1.200",
      unit: "m²",
      sourceEstimatedCost: "18000.00",
      sourceEstimatedCostCurrency: "EUR",
      targetYear: 2027,
      plannedYear: null,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.recommendations.capJointSealing,
      ...bridgeScope,
      workType: "FUGENINSTANDSETZUNG",
      description: "Offene Kappenfuge reinigen, vorbereiten und dauerhaft elastisch schließen.",
      urgency: "MITTELFRISTIG",
      quantity: "14.750",
      unit: "m",
      sourceEstimatedCost: null,
      sourceEstimatedCostCurrency: null,
      targetYear: 2027,
      plannedYear: null,
      status: "SCHEDULED",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.recommendations.pavementJointRepair,
      ...bridgeScope,
      workType: "FAHRBAHNFUGENINSTANDSETZUNG",
      description: "Schadhafte Fahrbahnanschlüsse an beiden Brückenenden aufnehmen und erneuern.",
      urgency: "MITTELFRISTIG",
      quantity: "30.000",
      unit: "m",
      sourceEstimatedCost: "24000.00",
      sourceEstimatedCostCurrency: "EUR",
      targetYear: 2026,
      plannedYear: null,
      status: "APPROVED",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.recommendations.drainageRepair,
      ...bridgeScope,
      workType: "ABDICHTUNG_ENTWAESSERUNG",
      description: "Blasenbereiche öffnen und erneuern sowie Ablauf und Anschlussdetails instand setzen.",
      urgency: "MITTELFRISTIG",
      quantity: "4.000",
      unit: "m²",
      sourceEstimatedCost: "12500.00",
      sourceEstimatedCostCurrency: "EUR",
      targetYear: 2027,
      plannedYear: null,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.recommendations.corrosionProtection,
      ...bridgeScope,
      workType: "KORROSIONSSCHUTZ",
      description: "Korrodierte Bereiche vorbereiten und Beschichtung der Schutzeinrichtungen erneuern.",
      urgency: "MITTELFRISTIG",
      quantity: "28.000",
      unit: "m",
      sourceEstimatedCost: "16000.00",
      sourceEstimatedCostCurrency: "EUR",
      targetYear: 2028,
      plannedYear: null,
      status: "OPEN",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies RecommendationInsert[],
  plannedInterventions: [
    {
      id: heideckhofwegIds.plannedInterventions.concreteRepair,
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.concreteRepair,
      workType: "Betoninstandsetzung an Überbau und Widerlager",
      plannedYear: 2027,
      quantity: "1.200",
      unit: "m²",
      estimatedCost: "20500.00",
      estimatedCostCurrency: "EUR",
      estimatedCostSource: "EXTERNAL_ENRICHED",
      estimatedCostStatus: "REVIEWED",
      status: "TENDER_PREPARATION",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.plannedInterventions.capJointSealing,
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.capJointSealing,
      workType: "Elastische Kappenfugenabdichtung",
      plannedYear: 2026,
      quantity: "14.750",
      unit: "m",
      estimatedCost: null,
      estimatedCostCurrency: null,
      estimatedCostSource: null,
      estimatedCostStatus: null,
      status: "PLANNED",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.plannedInterventions.pavementJointRepair,
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.pavementJointRepair,
      workType: "Erneuerung der Fahrbahnanschlüsse",
      plannedYear: 2026,
      quantity: "30.000",
      unit: "m",
      estimatedCost: "28000.00",
      estimatedCostCurrency: "EUR",
      estimatedCostSource: "USER_PLANNING",
      estimatedCostStatus: "DRAFT",
      status: "BUDGETED",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies PlannedInterventionInsert[],
  budgetProgram: {
    id: heideckhofwegIds.budgetProgram2026,
    planningYear: 2026,
    approvedBudgetAmount: "45000.00",
    currency: "EUR",
    createdAt: fixtureTimestamp,
    updatedAt: fixtureTimestamp
  } satisfies BudgetProgramInsert,
  budgetProgramInterventions: [
    {
      budgetProgramId: heideckhofwegIds.budgetProgram2026,
      interventionId: heideckhofwegIds.plannedInterventions.pavementJointRepair,
      planningYear: 2026,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      budgetProgramId: heideckhofwegIds.budgetProgram2026,
      interventionId: heideckhofwegIds.plannedInterventions.capJointSealing,
      planningYear: 2026,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies BudgetProgramInterventionInsert[],
  recommendationFindings: [
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.concreteRepair,
      findingId: heideckhofwegIds.findings.concreteCracking,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.concreteRepair,
      findingId: heideckhofwegIds.findings.exposedReinforcement,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.capJointSealing,
      findingId: heideckhofwegIds.findings.openCapJoint,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.pavementJointRepair,
      findingId: heideckhofwegIds.findings.pavementJoint,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.drainageRepair,
      findingId: heideckhofwegIds.findings.drainageBlister,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      ...bridgeScope,
      recommendationId: heideckhofwegIds.recommendations.corrosionProtection,
      findingId: heideckhofwegIds.findings.corrosionWeathering,
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies RecommendationFindingInsert[],
  historicalWorks: [
    {
      id: heideckhofwegIds.historicalWorks.originalConstruction,
      ...bridgeScope,
      type: "NEUBAU",
      title: "Neubau des Teilbauwerks (Demo)",
      reason: "Herstellung der Überführung Fiktivbach",
      contractor: null,
      client: "Bundesstraßenverwaltung (Demo)",
      startedOn: "1982-09-01",
      endedOn: "1983-11-30",
      quantity: "117.000",
      unit: "m² Brückenfläche",
      contractAmount: "920000.00",
      finalAmount: "980000.00",
      currency: "DEM",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.historicalWorks.concreteMaintenance,
      ...bridgeScope,
      type: "INSTANDSETZUNG",
      title: "Betoninstandsetzung und Fugenerneuerung (Demo)",
      reason: "Schadensbeseitigung nach Hauptprüfung",
      contractor: null,
      client: "Straßenbauverwaltung NRW (Demo)",
      startedOn: "2008-07-14",
      endedOn: "2008-10-31",
      quantity: null,
      unit: null,
      contractAmount: "128000.00",
      finalAmount: "132450.00",
      currency: "EUR",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.historicalWorks.pavementRenewal,
      ...bridgeScope,
      type: "ERNEUERUNG",
      title: "Erneuerung Belag und Abdichtung (Demo)",
      reason: "Verschleiß und lokale Undichtigkeiten",
      contractor: null,
      client: "Straßenbauverwaltung NRW (Demo)",
      startedOn: "2018-06-04",
      endedOn: "2018-07-20",
      quantity: "117.000",
      unit: "m²",
      contractAmount: "84500.00",
      finalAmount: "86740.00",
      currency: "EUR",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies HistoricalWorkInsert[],
  trafficObservations: [
    {
      id: heideckhofwegIds.traffic2015,
      bridgeId: heideckhofwegIds.bridge,
      observationYear: 2015,
      observedOn: "2015-01-01",
      dailyTraffic: 41878,
      truckSharePercent: "9.00",
      sourceDescription: "Straßenverkehrszählung 2015 (Demo fixture)",
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies TrafficObservationInsert[],
  documents: [
    {
      id: heideckhofwegIds.documents.structureBook,
      ...bridgeScope,
      type: "DEMO_BAUWERKSBUCH",
      originalFilename: "DEMO_Bauwerksbuch_9999999.pdf",
      status: "READY",
      metadata: {
        fixture: true,
        fixtureName: "musterbruecke-fiktivtal-9999999",
        fixtureVersion: "1",
        extractionPerformed: false,
        sourceMode: "DEMO_ONLY"
      },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    },
    {
      id: heideckhofwegIds.documents.inspectionReport2023,
      ...bridgeScope,
      type: "DEMO_PRUEFBERICHT",
      originalFilename: "DEMO_Hauptpruefung_9999999_2023.pdf",
      status: "READY",
      metadata: {
        fixture: true,
        fixtureName: "musterbruecke-fiktivtal-9999999",
        fixtureVersion: "1",
        extractionPerformed: false,
        sourceMode: "DEMO_ONLY"
      },
      createdAt: fixtureTimestamp,
      updatedAt: fixtureTimestamp
    }
  ] satisfies DocumentInsert[]
} as const;
