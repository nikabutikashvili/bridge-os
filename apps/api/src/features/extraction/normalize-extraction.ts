import {
  createBridgeSchema,
  createComponentSchema,
  createFindingSchema,
  createHistoricalWorkSchema,
  createInspectionSchema,
  createPartialStructureSchema,
  createRecommendationSchema,
  createTrafficObservationSchema,
  type ExtractedEvidence,
  type SectionExtractionOutput
} from "@bridge-os/contracts";

import { inferBridgeCoordinates } from "./infer-bridge-coordinates.js";
import { inferBridgeIdentity } from "./infer-bridge-identity.js";
import {
  attachInspectorsToInspections,
  inferFindingsFromPages,
  inferInspectionsFromPages,
  inferRecommendationsFromPages,
  linkRecommendationsFromFindingMentions,
  recommendationMeasureId
} from "./infer-section7.js";
import type {
  FieldEvidence,
  NormalizedBridge,
  NormalizedComponent,
  NormalizedExtractionBundle,
  NormalizedFinding,
  NormalizedHistoricalWork,
  NormalizedInspection,
  NormalizedPartialStructure,
  NormalizedRecommendation,
  NormalizedTrafficObservation
} from "./normalized-extraction.js";
import {
  inferUnitFromText,
  normalizeCurrency,
  normalizeDate,
  normalizeDecimal,
  normalizeFindingStatus,
  normalizeInspectionType,
  normalizeInteger,
  normalizeNullableString,
  normalizeRecommendationStatus,
  normalizeSvdRating,
  normalizeUnit,
  normalizeUrgency
} from "./normalize-values.js";

export interface NormalizeExtractionOptions {
  readonly documentId?: string;
  readonly originalFilename?: string;
  readonly pages?: readonly {
    readonly pageNumber?: number;
    readonly textContent: string;
  }[];
}

const placeholderInspectionKey = "inspection:document";

const validationUuid = "00000000-0000-4000-8000-000000000001";

type IdentityOutput = Extract<
  SectionExtractionOutput,
  { category: "IDENTITY_OVERVIEW" }
>;
type StructureOutput = Extract<
  SectionExtractionOutput,
  { category: "STRUCTURE_GEOMETRY" }
>;
type ComponentsOutput = Extract<
  SectionExtractionOutput,
  { category: "COMPONENTS_MATERIALS" }
>;
type InspectionsOutput = Extract<
  SectionExtractionOutput,
  { category: "INSPECTIONS" }
>;
type FindingsOutput = Extract<
  SectionExtractionOutput,
  { category: "FINDINGS_DAMAGE" }
>;
type RecommendationsOutput = Extract<
  SectionExtractionOutput,
  { category: "RECOMMENDATIONS" }
>;
type HistoricalWorksOutput = Extract<
  SectionExtractionOutput,
  { category: "HISTORICAL_WORKS_COSTS" }
>;
type TrafficOutput = Extract<
  SectionExtractionOutput,
  { category: "TRAFFIC_NETWORK" }
>;

interface SourcedField {
  readonly evidence: readonly ExtractedEvidence[];
  readonly value: unknown;
}

export function normalizeExtractionOutputs(
  outputs: readonly SectionExtractionOutput[],
  options: NormalizeExtractionOptions = {}
): NormalizedExtractionBundle {
  const identities: IdentityOutput[] = [];
  const structures: StructureOutput[] = [];
  const componentSections: ComponentsOutput[] = [];
  const inspectionSections: InspectionsOutput[] = [];
  const findingSections: FindingsOutput[] = [];
  const recommendationSections: RecommendationsOutput[] = [];
  const historicalWorkSections: HistoricalWorksOutput[] = [];
  const trafficSections: TrafficOutput[] = [];

  for (const output of outputs) {
    switch (output.category) {
      case "IDENTITY_OVERVIEW":
        identities.push(output);
        break;
      case "STRUCTURE_GEOMETRY":
        structures.push(output);
        break;
      case "COMPONENTS_MATERIALS":
        componentSections.push(output);
        break;
      case "INSPECTIONS":
        inspectionSections.push(output);
        break;
      case "FINDINGS_DAMAGE":
        findingSections.push(output);
        break;
      case "RECOMMENDATIONS":
        recommendationSections.push(output);
        break;
      case "HISTORICAL_WORKS_COSTS":
        historicalWorkSections.push(output);
        break;
      case "TRAFFIC_NETWORK":
        trafficSections.push(output);
        break;
    }
  }

  const bridgeCandidates = identities.flatMap((output) => {
    const bridge = tryNormalize(() => normalizeIdentityExtraction(output), null);
    return bridge === null ? [] : [bridge];
  });
  const bridge = fillMissingIdentity(
    bridgeCandidates.length === 0
      ? fallbackBridge(options)
      : mergeBridges(bridgeCandidates),
    options
  );

  const partials = coalesceRecords(
    structures.flatMap((output) =>
      tryNormalize(() => normalizeGeometryExtraction(output), [])
    ),
    (partial) => partial.values.externalPartialStructureNumber ?? partial.sourceKey,
    mergePartialStructure
  );
  const partialStructures = ensureDefaultPartial(partials.records);
  const defaultPartialKey = partialStructures[0]?.sourceKey ?? "partial:primary";
  const partialRemap = withDefaultRemap(partials.remap, defaultPartialKey);

  const components = keepFirstBySourceKey(
    componentSections.flatMap((output) =>
      output.components.flatMap((component) =>
        tryNormalize(() => [normalizeComponent(component)], [])
      )
    )
  ).map((component) => ({
    ...component,
    partialStructureRef: remapKey(partialRemap, component.partialStructureRef)
  }));

  const modelInspections = keepFirstBySourceKey(
    inspectionSections.flatMap((output) =>
      tryNormalize(() => normalizeInspectionsExtraction(output), [])
    )
  ).map((inspection) => ({
    ...inspection,
    partialStructureRef: remapPartialRef(
      partialRemap,
      partialStructures,
      inspection.partialStructureRef,
      defaultPartialKey
    )
  }));
  const inspections = attachInspectorsToInspections(
    mergeBySourceKey(
      modelInspections,
      inferInspectionsFromPages(options.pages ?? [], defaultPartialKey),
      sameInspection,
      fillMissingInspection
    ),
    options.pages ?? []
  );

  const modelFindings = keepFirstBySourceKey(
    findingSections.flatMap((output) =>
      tryNormalize(() => normalizeFindingsExtraction(output), [])
    )
  ).map((finding) => ({
    ...finding,
    partialStructureRef: remapPartialRef(
      partialRemap,
      partialStructures,
      finding.partialStructureRef,
      defaultPartialKey
    ),
    componentRef:
      finding.componentRef !== null &&
      components.some((component) => component.sourceKey === finding.componentRef)
        ? finding.componentRef
        : null
  }));
  const fallbackInspectionKey =
    latestInspectionKey(inspections) ?? placeholderInspectionKey;
  const findings = attachFindingsToInspections(
    mergeFindings(
      modelFindings,
      inferFindingsFromPages(
        options.pages ?? [],
        fallbackInspectionKey,
        defaultPartialKey
      )
    ),
    inspections,
    fallbackInspectionKey,
    defaultPartialKey
  );

  const findingKeys = new Set(findings.map((finding) => finding.sourceKey));
  const modelRecommendations = keepFirstBySourceKey(
    recommendationSections.flatMap((output) =>
      tryNormalize(() => normalizeRecommendationsExtraction(output), [])
    )
  ).map((recommendation) => ({
    ...recommendation,
    partialStructureRef: remapPartialRef(
      partialRemap,
      partialStructures,
      recommendation.partialStructureRef,
      defaultPartialKey
    )
  }));
  const recommendations = linkRecommendationsFromFindingMentions(
    mergeBySourceKey(
      modelRecommendations,
      inferRecommendationsFromPages(options.pages ?? [], defaultPartialKey),
      sameRecommendation,
      fillMissingRecommendation
    ),
    findings
  ).map((recommendation) => ({
    ...recommendation,
    linkedFindingRefs: resolveLinkedFindings(
      recommendation.linkedFindingRefs,
      findings,
      findingKeys
    )
  }));

  const historicalWorks = keepFirstBySourceKey(
    historicalWorkSections.flatMap((output) =>
      tryNormalize(() => normalizeHistoricalWorksExtraction(output), [])
    )
  ).map((work) => ({
    ...work,
    partialStructureRef:
      work.partialStructureRef === null
        ? null
        : remapKey(partialRemap, work.partialStructureRef)
  }));

  const trafficObservations = keepFirstBySourceKey(
    trafficSections.flatMap((output) =>
      tryNormalize(() => normalizeTrafficExtraction(output), [])
    )
  );

  return {
    bridge,
    partialStructures,
    components,
    inspections,
    findings,
    recommendations,
    historicalWorks,
    trafficObservations
  };
}

export function normalizeIdentityExtraction(
  output: IdentityOutput
): NormalizedBridge | null {
  return output.bridge === null ? null : normalizeBridge(output.bridge);
}

export function normalizeGeometryExtraction(
  output: StructureOutput
): NormalizedPartialStructure[] {
  return output.partialStructures.flatMap((partial) =>
    tryNormalize(() => [normalizePartialStructure(partial)], [])
  );
}

export function normalizeInspectionsExtraction(
  output: InspectionsOutput
): NormalizedInspection[] {
  return output.inspections.flatMap((inspection) =>
    tryNormalize(() => [normalizeInspection(inspection)], [])
  );
}

export function normalizeFindingsExtraction(
  output: FindingsOutput
): NormalizedFinding[] {
  return output.findings.flatMap((finding) =>
    tryNormalize(() => [normalizeFinding(finding)], [])
  );
}

export function normalizeRecommendationsExtraction(
  output: RecommendationsOutput
): NormalizedRecommendation[] {
  return output.recommendations.flatMap((recommendation) =>
    tryNormalize(() => [normalizeRecommendation(recommendation)], [])
  );
}

export function normalizeHistoricalWorksExtraction(
  output: HistoricalWorksOutput
): NormalizedHistoricalWork[] {
  return output.historicalWorks.flatMap((work) =>
    tryNormalize(() => [normalizeHistoricalWork(work)], [])
  );
}

export function normalizeTrafficExtraction(
  output: TrafficOutput
): NormalizedTrafficObservation[] {
  return output.trafficObservations.flatMap((observation) => {
    const normalized = tryNormalize(
      () => normalizeTrafficObservation(observation),
      null
    );
    return normalized === null ? [] : [normalized];
  });
}

function normalizeBridge(
  bridge: NonNullable<IdentityOutput["bridge"]>
): NormalizedBridge {
  const values = createBridgeSchema.parse({
    externalStructureNumber: normalizeNullableString(
      bridge.externalStructureNumber.value
    ),
    name: normalizeNullableString(bridge.name.value),
    road: normalizeNullableString(bridge.road.value),
    location: {
      countryCode: normalizeCountryCode(bridge.location.countryCode.value),
      federalState: normalizeNullableString(bridge.location.federalState.value),
      district: normalizeNullableString(bridge.location.district.value),
      municipality: normalizeNullableString(bridge.location.municipality.value),
      locality: normalizeNullableString(bridge.location.locality.value),
      postalCode: normalizeNullableString(bridge.location.postalCode.value),
      stationing: normalizeNullableString(bridge.location.stationing.value),
      crossedFeature: normalizeNullableString(bridge.location.crossedFeature.value),
      latitude: normalizeCoordinate(bridge.location.latitude.value, 90),
      longitude: normalizeCoordinate(bridge.location.longitude.value, 180)
    },
    owner: normalizeNullableString(bridge.owner.value),
    loadBearingResponsibility: normalizeNullableString(
      bridge.loadBearingResponsibility.value
    ),
    responsibleAuthority: normalizeNullableString(
      bridge.responsibleAuthority.value
    ),
    maintenanceOffice: normalizeNullableString(bridge.maintenanceOffice.value),
    dataOrigin: "EXTRACTED"
  });

  return {
    evidence: bridge.evidence,
    fieldEvidence: fieldEvidence([
      ["externalStructureNumber", bridge.externalStructureNumber],
      ["name", bridge.name],
      ["road", bridge.road],
      ["location.countryCode", bridge.location.countryCode],
      ["location.federalState", bridge.location.federalState],
      ["location.district", bridge.location.district],
      ["location.municipality", bridge.location.municipality],
      ["location.locality", bridge.location.locality],
      ["location.postalCode", bridge.location.postalCode],
      ["location.stationing", bridge.location.stationing],
      ["location.crossedFeature", bridge.location.crossedFeature],
      ["location.latitude", bridge.location.latitude],
      ["location.longitude", bridge.location.longitude],
      ["owner", bridge.owner],
      ["loadBearingResponsibility", bridge.loadBearingResponsibility],
      ["responsibleAuthority", bridge.responsibleAuthority],
      ["maintenanceOffice", bridge.maintenanceOffice]
    ]),
    values
  };
}

function normalizePartialStructure(
  partial: StructureOutput["partialStructures"][number]
): NormalizedPartialStructure {
  const values = {
    externalPartialStructureNumber: normalizeNullableString(
      partial.externalPartialStructureNumber.value
    ),
    name: normalizeNullableString(partial.name.value),
    constructionYear: normalizeInteger(partial.constructionYear.value),
    structureType: normalizeNullableString(partial.structureType.value),
    structuralSystem: normalizeNullableString(partial.structuralSystem.value),
    lengthM: normalizeDecimal(partial.length.value),
    widthM: normalizeDecimal(partial.width.value),
    areaSqM: normalizeDecimal(partial.area.value),
    clearHeightM: normalizeDecimal(partial.clearHeight.value),
    spanCount: normalizeInteger(partial.spanCount.value)
  };
  createPartialStructureSchema.parse({ bridgeId: validationUuid, ...values });
  return {
    sourceKey: partial.sourceKey,
    evidence: partial.evidence,
    fieldEvidence: fieldEvidence([
      ["externalPartialStructureNumber", partial.externalPartialStructureNumber],
      ["name", partial.name],
      ["constructionYear", partial.constructionYear],
      ["structureType", partial.structureType],
      ["structuralSystem", partial.structuralSystem],
      ["lengthM", partial.length],
      ["widthM", partial.width],
      ["areaSqM", partial.area],
      ["clearHeightM", partial.clearHeight],
      ["spanCount", partial.spanCount]
    ]),
    values
  };
}

function normalizeComponent(
  component: ComponentsOutput["components"][number]
): NormalizedComponent {
  const values = {
    type: normalizeNullableString(component.type.value),
    name: normalizeNullableString(component.name.value),
    location: normalizeNullableString(component.location.value),
    material: normalizeNullableString(component.material.value),
    constructionYear: normalizeInteger(component.constructionYear.value),
    installYear: normalizeInteger(component.installYear.value),
    additionalProperties: component.additionalProperties.value
  };
  createComponentSchema.parse({
    bridgeId: validationUuid,
    partialStructureId: validationUuid,
    ...values
  });
  return {
    sourceKey: component.sourceKey,
    partialStructureRef: component.partialStructureRef,
    evidence: component.evidence,
    fieldEvidence: fieldEvidence([
      ["type", component.type],
      ["name", component.name],
      ["location", component.location],
      ["material", component.material],
      ["constructionYear", component.constructionYear],
      ["installYear", component.installYear],
      ["additionalProperties", component.additionalProperties]
    ]),
    values
  };
}

function normalizeInspection(
  inspection: InspectionsOutput["inspections"][number]
): NormalizedInspection {
  const values = {
    type: normalizeInspectionType(inspection.type.value),
    inspectedOn: normalizeDate(inspection.inspectedOn.value),
    inspector: normalizeNullableString(inspection.inspector.value),
    conditionScore: normalizeDecimal(inspection.conditionScore.value),
    cycleMonths: normalizeInteger(inspection.cycleMonths.value)
  };
  createInspectionSchema.parse({
    bridgeId: validationUuid,
    partialStructureId: validationUuid,
    ...values
  });
  return {
    sourceKey: inspection.sourceKey,
    partialStructureRef: inspection.partialStructureRef,
    evidence: inspection.evidence,
    fieldEvidence: fieldEvidence([
      ["type", inspection.type],
      ["inspectedOn", inspection.inspectedOn],
      ["inspector", inspection.inspector],
      ["conditionScore", inspection.conditionScore],
      ["cycleMonths", inspection.cycleMonths]
    ]),
    values
  };
}

function normalizeFinding(
  finding: FindingsOutput["findings"][number]
): NormalizedFinding {
  const description = normalizeNullableString(finding.description.value);
  const extent = normalizeNullableString(finding.extent.value);
  const inferredUnit =
    inferUnitFromText(description) ?? inferUnitFromText(extent);
  const reconciledDimensions = reconcileMeasurementPair({
    length: normalizeDecimal(finding.dimensionLength.value),
    width: normalizeDecimal(finding.dimensionWidth.value),
    depth: normalizeDecimal(finding.dimensionDepth.value),
    unit: normalizeUnit(finding.dimensionUnit.value),
    inferredUnit
  });
  const reconciledQuantity = reconcileScalarPair(
    normalizeDecimal(finding.quantity.value),
    normalizeUnit(finding.quantityUnit.value),
    inferredUnit
  );
  const values = {
    sourceIdentifier: normalizeNullableString(finding.sourceIdentifier.value),
    defectType: normalizeNullableString(finding.defectType.value),
    description,
    location: normalizeNullableString(finding.location.value),
    extent,
    dimensionLength: reconciledDimensions.length,
    dimensionWidth: reconciledDimensions.width,
    dimensionDepth: reconciledDimensions.depth,
    dimensionUnit: reconciledDimensions.unit,
    quantity: reconciledQuantity.value,
    quantityUnit: reconciledQuantity.unit,
    stabilityRating: normalizeSvdRating(finding.stabilityRating.value),
    trafficSafetyRating: normalizeSvdRating(finding.trafficSafetyRating.value),
    durabilityRating: normalizeSvdRating(finding.durabilityRating.value),
    // Source text rarely states an explicit lifecycle status for a defect;
    // a finding the model can't classify is, by definition, not yet
    // resolved. Default to OPEN rather than leaving it null, which silently
    // dropped it out of every status in ('OPEN', 'MONITORING') aggregate
    // (headline S/V/D worst scores, maintenance priority, ...).
    status: normalizeFindingStatus(finding.status.value) ?? "OPEN"
  };
  createFindingSchema.parse({
    bridgeId: validationUuid,
    partialStructureId: validationUuid,
    inspectionId: validationUuid,
    componentId: finding.componentRef.value === null ? null : validationUuid,
    ...values
  });
  return {
    sourceKey: finding.sourceKey,
    partialStructureRef: finding.partialStructureRef,
    inspectionRef: finding.inspectionRef,
    componentRef: finding.componentRef.value,
    evidence: finding.evidence,
    fieldEvidence: fieldEvidence([
      ["componentId", finding.componentRef],
      ["sourceIdentifier", finding.sourceIdentifier],
      ["defectType", finding.defectType],
      ["description", finding.description],
      ["location", finding.location],
      ["extent", finding.extent],
      ["dimensionLength", finding.dimensionLength],
      ["dimensionWidth", finding.dimensionWidth],
      ["dimensionDepth", finding.dimensionDepth],
      ["dimensionUnit", finding.dimensionUnit],
      ["quantity", finding.quantity],
      ["quantityUnit", finding.quantityUnit],
      ["stabilityRating", finding.stabilityRating],
      ["trafficSafetyRating", finding.trafficSafetyRating],
      ["durabilityRating", finding.durabilityRating],
      ["status", finding.status]
    ]),
    values
  };
}

function normalizeRecommendation(
  recommendation: RecommendationsOutput["recommendations"][number]
): NormalizedRecommendation {
  const workType = normalizeNullableString(recommendation.workType.value);
  const description = normalizeNullableString(recommendation.description.value);
  const reconciledQuantity = reconcileScalarPair(
    normalizeDecimal(recommendation.quantity.value),
    normalizeUnit(recommendation.unit.value),
    inferUnitFromText(workType) ?? inferUnitFromText(description)
  );
  const cost = normalizeDecimal(recommendation.sourceEstimatedCost.value);
  const currency = normalizeCurrency(
    recommendation.sourceEstimatedCostCurrency.value
  );
  const values = {
    workType,
    description,
    urgency: normalizeUrgency(recommendation.urgency.value),
    quantity: reconciledQuantity.value,
    unit: reconciledQuantity.unit,
    sourceEstimatedCost: cost,
    sourceEstimatedCostCurrency:
      cost === null ? null : (currency ?? "EUR"),
    targetYear: normalizeInteger(recommendation.targetYear.value),
    plannedYear: normalizeInteger(recommendation.plannedYear.value),
    // Same reasoning as finding status: source text rarely states an
    // explicit workflow status per recommendation, and an unclassified
    // recommendation is still open until dispositioned. Defaulting to null
    // silently dropped it out of every status in (...) aggregate (portfolio
    // urgency, next action, maintenance priority, ...).
    status: normalizeRecommendationStatus(recommendation.status.value) ?? "OPEN"
  };
  createRecommendationSchema.parse({
    bridgeId: validationUuid,
    partialStructureId: validationUuid,
    ...values
  });
  return {
    sourceKey: recommendation.sourceKey,
    partialStructureRef: recommendation.partialStructureRef,
    linkedFindingRefs: recommendation.linkedFindingRefs,
    evidence: recommendation.evidence,
    fieldEvidence: fieldEvidence([
      ["workType", recommendation.workType],
      ["description", recommendation.description],
      ["urgency", recommendation.urgency],
      ["quantity", recommendation.quantity],
      ["unit", recommendation.unit],
      ["sourceEstimatedCost", recommendation.sourceEstimatedCost],
      [
        "sourceEstimatedCostCurrency",
        recommendation.sourceEstimatedCostCurrency
      ],
      ["targetYear", recommendation.targetYear],
      ["plannedYear", recommendation.plannedYear],
      ["status", recommendation.status]
    ]),
    values
  };
}

function normalizeHistoricalWork(
  work: HistoricalWorksOutput["historicalWorks"][number]
): NormalizedHistoricalWork {
  const historicalQuantity = reconcileScalarPair(
    normalizeDecimal(work.quantity.value),
    normalizeUnit(work.unit.value),
    inferUnitFromText(normalizeNullableString(work.title.value))
  );
  const contractAmount = normalizeDecimal(work.contractAmount.value);
  const finalAmount = normalizeDecimal(work.finalAmount.value);
  const historicalAmounts = {
    contractAmount,
    finalAmount,
    currency:
      contractAmount === null && finalAmount === null
        ? null
        : (normalizeCurrency(work.currency.value) ?? "EUR")
  };
  const values = {
    type: normalizeNullableString(work.type.value),
    title: normalizeNullableString(work.title.value),
    reason: normalizeNullableString(work.reason.value),
    contractor: normalizeNullableString(work.contractor.value),
    client: normalizeNullableString(work.client.value),
    startedOn: normalizeDate(work.startedOn.value),
    endedOn: normalizeDate(work.endedOn.value),
    quantity: historicalQuantity.value,
    unit: historicalQuantity.unit,
    contractAmount: historicalAmounts.contractAmount,
    finalAmount: historicalAmounts.finalAmount,
    currency: historicalAmounts.currency
  };
  createHistoricalWorkSchema.parse({
    bridgeId: validationUuid,
    partialStructureId:
      work.partialStructureRef === null ? null : validationUuid,
    ...values
  });
  return {
    sourceKey: work.sourceKey,
    partialStructureRef: work.partialStructureRef,
    evidence: work.evidence,
    fieldEvidence: fieldEvidence([
      ["type", work.type],
      ["title", work.title],
      ["reason", work.reason],
      ["contractor", work.contractor],
      ["client", work.client],
      ["startedOn", work.startedOn],
      ["endedOn", work.endedOn],
      ["quantity", work.quantity],
      ["unit", work.unit],
      ["contractAmount", work.contractAmount],
      ["finalAmount", work.finalAmount],
      ["currency", work.currency]
    ]),
    values
  };
}

function normalizeTrafficObservation(
  observation: TrafficOutput["trafficObservations"][number]
): NormalizedTrafficObservation | null {
  const observationYear = normalizeInteger(observation.observationYear.value);
  if (observationYear === null) {
    return null;
  }
  const values = {
    observationYear,
    observedOn: normalizeDate(observation.observedOn.value),
    dailyTraffic: normalizeInteger(observation.dailyTraffic.value),
    truckSharePercent: normalizeDecimal(observation.truckSharePercent.value),
    sourceDescription: normalizeNullableString(
      observation.sourceDescription.value
    )
  };
  createTrafficObservationSchema.parse({ bridgeId: validationUuid, ...values });
  return {
    sourceKey: observation.sourceKey,
    evidence: observation.evidence,
    fieldEvidence: fieldEvidence([
      ["observationYear", observation.observationYear],
      ["observedOn", observation.observedOn],
      ["dailyTraffic", observation.dailyTraffic],
      ["truckSharePercent", observation.truckSharePercent],
      ["sourceDescription", observation.sourceDescription]
    ]),
    values
  };
}

function fieldEvidence(
  entries: readonly (readonly [string, SourcedField])[]
): FieldEvidence {
  return Object.fromEntries(
    entries.map(([fieldName, field]) => [fieldName, field.evidence])
  );
}

function fillMissingIdentity(
  bridge: NormalizedBridge,
  options: NormalizeExtractionOptions
): NormalizedBridge {
  const inferredIdentity =
    bridge.values.externalStructureNumber === null ||
    bridge.values.name === null ||
    bridge.values.road === null
      ? inferBridgeIdentity(options.pages ?? [])
      : null;
  const inferredCoordinates = inferBridgeCoordinates(options.pages ?? []);
  const documentSuffix =
    options.documentId === undefined
      ? "unknown"
      : options.documentId.replaceAll("-", "").slice(0, 12);
  const latitude = bridge.values.location.latitude ?? inferredCoordinates.latitude;
  const longitude =
    bridge.values.location.longitude ?? inferredCoordinates.longitude;
  return {
    ...bridge,
    fieldEvidence: mergeCoordinateEvidence(bridge.fieldEvidence, inferredCoordinates.evidence, {
      latitudeFilled: bridge.values.location.latitude === null && latitude !== null,
      longitudeFilled: bridge.values.location.longitude === null && longitude !== null
    }),
    values: {
      ...bridge.values,
      externalStructureNumber:
        bridge.values.externalStructureNumber ??
        inferredIdentity?.externalStructureNumber ??
        `DOC-${documentSuffix}`,
      name:
        bridge.values.name ?? inferredIdentity?.name ?? filenameStem(options.originalFilename),
      road: bridge.values.road ?? inferredIdentity?.road ?? null,
      location: {
        ...bridge.values.location,
        latitude,
        longitude
      }
    }
  };
}

function fallbackBridge(options: NormalizeExtractionOptions): NormalizedBridge {
  const inferred = inferBridgeIdentity(options.pages ?? []);
  const documentSuffix =
    options.documentId === undefined
      ? "unknown"
      : options.documentId.replaceAll("-", "").slice(0, 12);
  const values = createBridgeSchema.parse({
    externalStructureNumber:
      inferred.externalStructureNumber ?? `DOC-${documentSuffix}`,
      name: inferred.name ?? filenameStem(options.originalFilename),
      road: inferred.road,
    location: emptyLocation(),
    owner: null,
    loadBearingResponsibility: null,
    responsibleAuthority: null,
    maintenanceOffice: null,
    dataOrigin: "EXTRACTED"
  });
  return { evidence: [], fieldEvidence: {}, values };
}

function mergeBridges(bridges: readonly NormalizedBridge[]): NormalizedBridge {
  const [first, ...rest] = bridges;
  if (first === undefined) {
    return fallbackBridge({});
  }
  return rest.reduce(
    (merged, next) => ({
      evidence: [...merged.evidence, ...next.evidence],
      fieldEvidence: mergeFieldEvidence(merged.fieldEvidence, next.fieldEvidence),
      values: {
        ...merged.values,
        externalStructureNumber:
          merged.values.externalStructureNumber ??
          next.values.externalStructureNumber,
        name: merged.values.name ?? next.values.name,
        road: merged.values.road ?? next.values.road,
        owner: merged.values.owner ?? next.values.owner,
        loadBearingResponsibility:
          merged.values.loadBearingResponsibility ??
          next.values.loadBearingResponsibility,
        responsibleAuthority:
          merged.values.responsibleAuthority ?? next.values.responsibleAuthority,
        maintenanceOffice:
          merged.values.maintenanceOffice ?? next.values.maintenanceOffice,
        location: {
          countryCode:
            merged.values.location.countryCode ?? next.values.location.countryCode,
          federalState:
            merged.values.location.federalState ??
            next.values.location.federalState,
          district: merged.values.location.district ?? next.values.location.district,
          municipality:
            merged.values.location.municipality ??
            next.values.location.municipality,
          locality: merged.values.location.locality ?? next.values.location.locality,
          postalCode:
            merged.values.location.postalCode ?? next.values.location.postalCode,
          stationing:
            merged.values.location.stationing ?? next.values.location.stationing,
          crossedFeature:
            merged.values.location.crossedFeature ??
            next.values.location.crossedFeature,
          latitude: merged.values.location.latitude ?? next.values.location.latitude,
          longitude:
            merged.values.location.longitude ?? next.values.location.longitude
        }
      }
    }),
    first
  );
}

function mergePartialStructure(
  current: NormalizedPartialStructure,
  next: NormalizedPartialStructure
): NormalizedPartialStructure {
  return {
    sourceKey: current.sourceKey,
    evidence: [...current.evidence, ...next.evidence],
    fieldEvidence: mergeFieldEvidence(current.fieldEvidence, next.fieldEvidence),
    values: {
      externalPartialStructureNumber:
        current.values.externalPartialStructureNumber ??
        next.values.externalPartialStructureNumber,
      name: current.values.name ?? next.values.name,
      constructionYear: current.values.constructionYear ?? next.values.constructionYear,
      structureType: current.values.structureType ?? next.values.structureType,
      structuralSystem: current.values.structuralSystem ?? next.values.structuralSystem,
      lengthM: current.values.lengthM ?? next.values.lengthM,
      widthM: current.values.widthM ?? next.values.widthM,
      areaSqM: current.values.areaSqM ?? next.values.areaSqM,
      clearHeightM: current.values.clearHeightM ?? next.values.clearHeightM,
      spanCount: current.values.spanCount ?? next.values.spanCount
    }
  };
}

function ensureDefaultPartial(
  partials: readonly NormalizedPartialStructure[]
): NormalizedPartialStructure[] {
  if (partials.length > 0) {
    return [...partials];
  }
  return [
    {
      sourceKey: "partial:primary",
      evidence: [],
      fieldEvidence: {},
      values: {
        externalPartialStructureNumber: "1",
        name: null,
        constructionYear: null,
        structureType: null,
        structuralSystem: null,
        lengthM: null,
        widthM: null,
        areaSqM: null,
        clearHeightM: null,
        spanCount: null
      }
    }
  ];
}

function coalesceRecords<T extends { readonly sourceKey: string }>(
  records: readonly T[],
  identity: (record: T) => string,
  merge: (current: T, next: T) => T
): { readonly records: T[]; readonly remap: Map<string, string> } {
  // Records sharing the same literal sourceKey always refer to the same
  // entity, even when the domain identity() derived from their values
  // (e.g. an externally reported number) differs across chunks because one
  // chunk left it null. Collapsing exact sourceKey duplicates first ensures
  // no two output records can ever carry the same sourceKey, which callers
  // rely on to map one sourceKey to exactly one persisted row.
  const bySourceKey = new Map<string, T>();
  for (const record of records) {
    const existing = bySourceKey.get(record.sourceKey);
    bySourceKey.set(
      record.sourceKey,
      existing === undefined ? record : merge(existing, record)
    );
  }

  const remap = new Map<string, string>();
  const byIdentity = new Map<string, T>();
  for (const record of bySourceKey.values()) {
    const key = identity(record);
    const existing = byIdentity.get(key);
    if (existing === undefined) {
      byIdentity.set(key, record);
      remap.set(record.sourceKey, record.sourceKey);
      continue;
    }
    remap.set(record.sourceKey, existing.sourceKey);
    byIdentity.set(key, merge(existing, record));
  }
  return { records: [...byIdentity.values()], remap };
}

function keepFirstBySourceKey<T extends { readonly sourceKey: string }>(
  records: readonly T[]
): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const record of records) {
    if (seen.has(record.sourceKey)) {
      continue;
    }
    seen.add(record.sourceKey);
    kept.push(record);
  }
  return kept;
}

function withDefaultRemap(
  remap: ReadonlyMap<string, string>,
  defaultKey: string
): Map<string, string> {
  return new Map(remap.entries()).set("", defaultKey);
}

function remapKey(remap: ReadonlyMap<string, string>, sourceKey: string): string {
  return remap.get(sourceKey) ?? remap.get("") ?? sourceKey;
}

function mergeFieldEvidence(left: FieldEvidence, right: FieldEvidence): FieldEvidence {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Object.fromEntries(
    [...keys].map((key) => [key, [...(left[key] ?? []), ...(right[key] ?? [])]])
  );
}

function mergeCoordinateEvidence(
  fieldEvidence: FieldEvidence,
  evidence: ExtractedEvidence | null,
  filled: {
    readonly latitudeFilled: boolean;
    readonly longitudeFilled: boolean;
  }
): FieldEvidence {
  if (evidence === null || (!filled.latitudeFilled && !filled.longitudeFilled)) {
    return fieldEvidence;
  }
  return {
    ...fieldEvidence,
    ...(filled.latitudeFilled ? { "location.latitude": [evidence] } : {}),
    ...(filled.longitudeFilled ? { "location.longitude": [evidence] } : {})
  };
}

function emptyLocation(): NormalizedBridge["values"]["location"] {
  return {
    countryCode: null,
    federalState: null,
    district: null,
    municipality: null,
    locality: null,
    postalCode: null,
    stationing: null,
    crossedFeature: null,
    latitude: null,
    longitude: null
  };
}

function normalizeCountryCode(value: string | null): string | null {
  const text = normalizeNullableString(value);
  if (text === null) {
    return null;
  }
  const upper = text.toUpperCase();
  if (upper.length === 2) {
    return upper;
  }
  if (upper === "DEUTSCHLAND" || upper === "GERMANY" || upper === "D") {
    return "DE";
  }
  return null;
}

function normalizeCoordinate(
  value: string | number | null,
  absoluteLimit: number
): string | null {
  const normalized = normalizeDecimal(value, { allowNegative: true });
  if (normalized === null || Math.abs(Number(normalized)) > absoluteLimit) {
    return null;
  }
  return normalized;
}

function filenameStem(filename: string | undefined): string | null {
  if (filename === undefined) {
    return null;
  }
  const stem = filename.replace(/\.pdf$/i, "").trim();
  return stem.length > 0 ? stem : null;
}

function tryNormalize<T>(normalize: () => T, fallback: T): T {
  try {
    return normalize();
  } catch {
    return fallback;
  }
}

function remapPartialRef(
  remap: ReadonlyMap<string, string>,
  partials: readonly NormalizedPartialStructure[],
  sourceKey: string,
  defaultKey: string
): string {
  const remapped = remap.get(sourceKey) ?? sourceKey;
  return partials.some((partial) => partial.sourceKey === remapped)
    ? remapped
    : defaultKey;
}

function latestInspectionKey(
  inspections: readonly NormalizedInspection[]
): string | null {
  const dated = [...inspections]
    .filter((inspection) => inspection.values.inspectedOn !== null)
    .sort((left, right) =>
      (right.values.inspectedOn ?? "").localeCompare(
        left.values.inspectedOn ?? ""
      )
    );
  return dated[0]?.sourceKey ?? inspections[0]?.sourceKey ?? null;
}

function attachFindingsToInspections(
  findings: readonly NormalizedFinding[],
  inspections: NormalizedInspection[],
  fallbackInspectionKey: string,
  defaultPartialKey: string
): NormalizedFinding[] {
  if (findings.length === 0) {
    return [];
  }
  const inspectionKeys = new Set(
    inspections.map((inspection) => inspection.sourceKey)
  );
  if (!inspectionKeys.has(fallbackInspectionKey)) {
    inspections.push(placeholderInspection(defaultPartialKey));
    inspectionKeys.add(placeholderInspectionKey);
  }
  const resolvedFallback = inspectionKeys.has(fallbackInspectionKey)
    ? fallbackInspectionKey
    : placeholderInspectionKey;
  return findings.map((finding) => ({
    ...finding,
    inspectionRef: inspectionKeys.has(finding.inspectionRef)
      ? finding.inspectionRef
      : resolvedFallback
  }));
}

function placeholderInspection(
  partialStructureRef: string
): NormalizedInspection {
  return {
    sourceKey: placeholderInspectionKey,
    partialStructureRef,
    evidence: [],
    fieldEvidence: {},
    values: {
      type: "MAIN",
      inspectedOn: null,
      inspector: null,
      conditionScore: null,
      cycleMonths: null
    }
  };
}

function mergeFindings(
  model: readonly NormalizedFinding[],
  inferred: readonly NormalizedFinding[]
): NormalizedFinding[] {
  const byIdentity = new Map<string, NormalizedFinding>();
  for (const finding of model) {
    byIdentity.set(findingIdentity(finding), finding);
  }
  for (const finding of inferred) {
    const key = findingIdentity(finding);
    const existing = byIdentity.get(key);
    byIdentity.set(
      key,
      existing === undefined ? finding : fillMissingFinding(existing, finding)
    );
  }
  return [...byIdentity.values()];
}

function fillMissingFinding(
  current: NormalizedFinding,
  next: NormalizedFinding
): NormalizedFinding {
  return {
    ...current,
    evidence: [...current.evidence, ...next.evidence],
    fieldEvidence: mergeFieldEvidence(current.fieldEvidence, next.fieldEvidence),
    values: {
      ...current.values,
      sourceIdentifier:
        current.values.sourceIdentifier ?? next.values.sourceIdentifier,
      description: current.values.description ?? next.values.description,
      stabilityRating:
        current.values.stabilityRating ?? next.values.stabilityRating,
      trafficSafetyRating:
        current.values.trafficSafetyRating ?? next.values.trafficSafetyRating,
      durabilityRating:
        current.values.durabilityRating ?? next.values.durabilityRating
    }
  };
}

function fillMissingInspection(
  current: NormalizedInspection,
  next: NormalizedInspection
): NormalizedInspection {
  return {
    ...current,
    evidence: [...current.evidence, ...next.evidence],
    fieldEvidence: mergeFieldEvidence(current.fieldEvidence, next.fieldEvidence),
    values: {
      ...current.values,
      type: current.values.type ?? next.values.type,
      inspectedOn: current.values.inspectedOn ?? next.values.inspectedOn,
      inspector: current.values.inspector ?? next.values.inspector,
      conditionScore: current.values.conditionScore ?? next.values.conditionScore,
      cycleMonths: current.values.cycleMonths ?? next.values.cycleMonths
    }
  };
}

function fillMissingRecommendation(
  current: NormalizedRecommendation,
  next: NormalizedRecommendation
): NormalizedRecommendation {
  const quantity = current.values.quantity ?? next.values.quantity;
  const unit = current.values.unit ?? next.values.unit;
  const cost = current.values.sourceEstimatedCost ?? next.values.sourceEstimatedCost;
  const currency =
    current.values.sourceEstimatedCostCurrency ??
    next.values.sourceEstimatedCostCurrency;
  return {
    ...current,
    linkedFindingRefs: uniqueStrings([
      ...current.linkedFindingRefs,
      ...next.linkedFindingRefs
    ]),
    evidence: [...current.evidence, ...next.evidence],
    fieldEvidence: mergeFieldEvidence(current.fieldEvidence, next.fieldEvidence),
    values: {
      ...current.values,
      workType: current.values.workType ?? next.values.workType,
      description: current.values.description ?? next.values.description,
      urgency: current.values.urgency ?? next.values.urgency,
      quantity: quantity !== null && unit !== null ? quantity : null,
      unit: quantity !== null && unit !== null ? unit : null,
      sourceEstimatedCost: cost,
      sourceEstimatedCostCurrency: cost === null ? null : (currency ?? "EUR"),
      targetYear: current.values.targetYear ?? next.values.targetYear,
      plannedYear: current.values.plannedYear ?? next.values.plannedYear
    }
  };
}

function mergeBySourceKey<T extends { readonly sourceKey: string }>(
  model: readonly T[],
  inferred: readonly T[],
  same: (left: T, right: T) => boolean,
  fill: (current: T, next: T) => T
): T[] {
  const merged = [...model];
  for (const record of inferred) {
    const index = merged.findIndex(
      (existing) => existing.sourceKey === record.sourceKey || same(existing, record)
    );
    if (index === -1) {
      merged.push(record);
      continue;
    }
    const current = merged[index];
    if (current === undefined) {
      merged.push(record);
      continue;
    }
    merged[index] = fill(current, record);
  }
  return merged;
}

function sameInspection(
  left: NormalizedInspection,
  right: NormalizedInspection
): boolean {
  return (
    left.values.inspectedOn !== null &&
    left.values.inspectedOn === right.values.inspectedOn &&
    left.values.type === right.values.type
  );
}

function sameRecommendation(
  left: NormalizedRecommendation,
  right: NormalizedRecommendation
): boolean {
  const leftMeasureId = recommendationMeasureId(left);
  const rightMeasureId = recommendationMeasureId(right);
  if (leftMeasureId !== null && leftMeasureId === rightMeasureId) {
    return true;
  }
  return (
    left.values.workType !== null &&
    left.values.workType === right.values.workType &&
    left.values.urgency === right.values.urgency
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function findingIdentity(finding: NormalizedFinding): string {
  const identifier = finding.values.sourceIdentifier ?? finding.sourceKey;
  const digits = /(\d+)/.exec(identifier);
  return digits?.[1] ?? identifier;
}

function resolveLinkedFindings(
  refs: readonly string[],
  findings: readonly NormalizedFinding[],
  findingKeys: ReadonlySet<string>
): string[] {
  const index = new Map<string, string>();
  for (const finding of findings) {
    for (const key of findingLinkKeys(finding)) {
      index.set(key, finding.sourceKey);
    }
  }
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const sourceKey = findingKeys.has(ref) ? ref : index.get(normalizeFindingLink(ref));
    if (sourceKey === undefined || seen.has(sourceKey)) {
      continue;
    }
    seen.add(sourceKey);
    resolved.push(sourceKey);
  }
  return resolved;
}

function findingLinkKeys(finding: NormalizedFinding): string[] {
  const keys = [finding.sourceKey, normalizeFindingLink(finding.sourceKey)];
  const identifier = finding.values.sourceIdentifier;
  if (identifier !== null) {
    keys.push(identifier, normalizeFindingLink(identifier));
  }
  return keys;
}

function normalizeFindingLink(value: string): string {
  const digits = /(\d+)/.exec(value);
  return digits?.[1] ?? value.trim();
}

function reconcileMeasurementPair(input: {
  readonly length: string | null;
  readonly width: string | null;
  readonly depth: string | null;
  readonly unit: string | null;
  readonly inferredUnit: string | null;
}): {
  readonly length: string | null;
  readonly width: string | null;
  readonly depth: string | null;
  readonly unit: string | null;
} {
  const hasDimension =
    input.length !== null || input.width !== null || input.depth !== null;
  const unit = input.unit ?? (hasDimension ? input.inferredUnit : null);
  if (hasDimension && unit === null) {
    return { length: null, width: null, depth: null, unit: null };
  }
  if (!hasDimension) {
    return { length: null, width: null, depth: null, unit: null };
  }
  return {
    length: input.length,
    width: input.width,
    depth: input.depth,
    unit
  };
}

function reconcileScalarPair(
  value: string | null,
  unit: string | null,
  inferredUnit: string | null
): { readonly value: string | null; readonly unit: string | null } {
  if (value !== null) {
    const resolvedUnit = unit ?? inferredUnit;
    return resolvedUnit === null
      ? { value: null, unit: null }
      : { value, unit: resolvedUnit };
  }
  return { value: null, unit: null };
}
