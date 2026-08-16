import type { BridgeDataHealthIndicator } from "@bridge-os/contracts";

export const TRAFFIC_STALE_AFTER_YEARS = 5;

export interface DataHealthPolicyInput {
  readonly asOf: Date;
  readonly latestInspection: {
    readonly inspectedOn: string | null;
    readonly type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null;
  } | null;
  readonly latestTrafficObservationYear: number | null;
  readonly partialStructures: readonly {
    readonly areaSqM: string | null;
    readonly lengthM: string | null;
    readonly spanCount: number | null;
    readonly widthM: string | null;
  }[];
  readonly unresolvedExtractionErrors: number;
  readonly recommendationsWithoutQuantity: number;
  readonly recommendationsWithoutCostEstimate: number;
  readonly extractedFindingsRequiringReview: number;
  readonly criticalExtractedFindingsWithoutEvidence: number;
  readonly hasLoadRecalculationDocument: boolean;
}

export function deriveBridgeDataHealth(
  input: DataHealthPolicyInput
): BridgeDataHealthIndicator[] {
  return [
    inspectionIndicator(input.latestInspection),
    trafficIndicator(input.latestTrafficObservationYear, input.asOf),
    geometryIndicator(input.partialStructures),
    countIndicator({
      code: "EXTRACTION_ERRORS",
      count: input.unresolvedExtractionErrors,
      label: "Extraction and processing",
      clearDetail: "No unresolved processing or extraction errors are recorded.",
      issueDetail: (count) =>
        `${plural(count, "linked document has", "linked documents have")} an unresolved processing or extraction error.`,
      issueStatus: "ERROR"
    }),
    countIndicator({
      code: "RECOMMENDATION_QUANTITIES",
      count: input.recommendationsWithoutQuantity,
      label: "Recommendation quantities",
      clearDetail: "All unresolved recommendations have a quantity and unit.",
      issueDetail: (count) =>
        `${String(count)} unresolved ${plural(count, "recommendation is", "recommendations are")} missing a quantity or unit.`,
      issueStatus: "MISSING"
    }),
    countIndicator({
      code: "RECOMMENDATION_COST_ESTIMATES",
      count: input.recommendationsWithoutCostEstimate,
      label: "Cost estimates",
      clearDetail:
        "Every unresolved recommendation has a source or managerial cost estimate.",
      issueDetail: (count) =>
        `${String(count)} unresolved ${plural(count, "recommendation has", "recommendations have")} no recorded source or managerial cost estimate.`,
      issueStatus: "MISSING"
    }),
    countIndicator({
      code: "EXTRACTED_FINDING_REVIEW",
      count: input.extractedFindingsRequiringReview,
      label: "Extracted finding review",
      clearDetail: "No automatically extracted findings are awaiting review.",
      issueDetail: (count) =>
        `${String(count)} extracted ${plural(count, "finding requires", "findings require")} review.`,
      issueStatus: "REVIEW_REQUIRED"
    }),
    countIndicator({
      code: "CRITICAL_SOURCE_EVIDENCE",
      count: input.criticalExtractedFindingsWithoutEvidence,
      label: "Critical finding evidence",
      clearDetail:
        "No critical extracted finding is missing page-level source-fact evidence.",
      issueDetail: (count) =>
        `${String(count)} critical extracted ${plural(count, "finding is", "findings are")} missing page-level source-fact evidence.`,
      issueStatus: "ERROR"
    }),
    input.hasLoadRecalculationDocument
      ? {
          code: "LOAD_RECALCULATION_DOCUMENT",
          status: "AVAILABLE",
          label: "Load recalculation information",
          detail: "A load recalculation or structural verification document is recorded.",
          count: 1
        }
      : {
          code: "LOAD_RECALCULATION_DOCUMENT",
          status: "MISSING",
          label: "Load recalculation information",
          detail: "No load recalculation or structural verification document is recorded.",
          count: 0
        }
  ];
}

export function isAttentionIndicator(
  indicator: BridgeDataHealthIndicator
): boolean {
  return !["AVAILABLE", "CURRENT", "COMPLETE"].includes(indicator.status);
}

export function isLoadRecalculationDocument(
  type: string,
  originalFilename: string
): boolean {
  const normalized = `${type} ${originalFilename}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleUpperCase("de-DE");
  return [
    "NACHRECHNUNG",
    "LASTNACHRECHNUNG",
    "TRAGFAHIGKEITSNACHWEIS",
    "STATISCHE BERECHNUNG"
  ].some((term) => normalized.includes(term));
}

function inspectionIndicator(
  inspection: DataHealthPolicyInput["latestInspection"]
): BridgeDataHealthIndicator {
  if (inspection?.inspectedOn === null || inspection === null) {
    return {
      code: "LATEST_INSPECTION",
      status: "MISSING",
      label: "Latest inspection",
      detail: "No dated inspection record is available.",
      count: 0
    };
  }
  return {
    code: "LATEST_INSPECTION",
    status: "AVAILABLE",
    label: "Latest inspection",
    detail: `Latest ${inspection.type ?? "OTHER"} inspection is dated ${inspection.inspectedOn}.`,
    count: 1
  };
}

function trafficIndicator(
  observationYear: number | null,
  asOf: Date
): BridgeDataHealthIndicator {
  if (observationYear === null) {
    return {
      code: "TRAFFIC_CURRENCY",
      status: "MISSING",
      label: "Traffic observation",
      detail: "No traffic observation is recorded.",
      count: 0
    };
  }
  const ageYears = Math.max(0, asOf.getUTCFullYear() - observationYear);
  return {
    code: "TRAFFIC_CURRENCY",
    status: ageYears > TRAFFIC_STALE_AFTER_YEARS ? "STALE" : "CURRENT",
    label: "Traffic observation",
    detail: `Traffic data is ${String(ageYears)} years old (${String(observationYear)}).`,
    count: ageYears
  };
}

function geometryIndicator(
  structures: DataHealthPolicyInput["partialStructures"]
): BridgeDataHealthIndicator {
  if (structures.length === 0) {
    return {
      code: "GEOMETRY_COMPLETENESS",
      status: "MISSING",
      label: "Core geometry",
      detail: "No partial-structure geometry is recorded.",
      count: 0
    };
  }
  const incompleteCount = structures.filter(
    (structure) =>
      structure.lengthM === null ||
      structure.widthM === null ||
      structure.areaSqM === null ||
      structure.spanCount === null
  ).length;
  if (incompleteCount > 0) {
    return {
      code: "GEOMETRY_COMPLETENESS",
      status: "MISSING",
      label: "Core geometry",
      detail: `${String(incompleteCount)} ${plural(incompleteCount, "partial structure is", "partial structures are")} missing length, width, area, or span count.`,
      count: incompleteCount
    };
  }
  return {
    code: "GEOMETRY_COMPLETENESS",
    status: "COMPLETE",
    label: "Core geometry",
    detail: `Length, width, area, and span count are recorded for ${String(structures.length)} ${structures.length === 1 ? "partial structure" : "partial structures"}.`,
    count: structures.length
  };
}

function countIndicator(input: {
  readonly clearDetail: string;
  readonly code: BridgeDataHealthIndicator["code"];
  readonly count: number;
  readonly issueDetail: (count: number) => string;
  readonly issueStatus: "ERROR" | "MISSING" | "REVIEW_REQUIRED";
  readonly label: string;
}): BridgeDataHealthIndicator {
  return {
    code: input.code,
    status: input.count === 0 ? "COMPLETE" : input.issueStatus,
    label: input.label,
    detail: input.count === 0 ? input.clearDetail : input.issueDetail(input.count),
    count: input.count
  };
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}
