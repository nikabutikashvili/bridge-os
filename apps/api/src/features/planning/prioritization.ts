import type {
  InspectionDueStatus,
  NetworkCriticalityBand,
  PlanningPriority,
  PlanningPriorityLevel,
  PlanningPriorityReasonCode
} from "@bridge-os/contracts";

export interface MaintenancePriorityInput {
  readonly asOf: string;
  readonly conditionDelta: string | null;
  readonly hasEnvironmentalExposure: boolean;
  readonly inspectionStatus: InspectionDueStatus;
  readonly maximumDurability: number | null;
  readonly maximumStability: number | null;
  readonly maximumTrafficSafety: number | null;
  readonly networkBand: NetworkCriticalityBand | null;
  readonly extraVehicleKmPerDay: number | null;
  readonly additionalDistanceKm: string | null;
  readonly dailyTraffic: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly alternativeCrossingCount: number | null;
  readonly recommendationSourceDate: string | null;
  readonly urgency: string | null;
}

interface PriorityReasonDefinition {
  readonly code: PlanningPriorityReasonCode;
  readonly detail: string;
  readonly label: string;
  readonly severity: PlanningPriorityLevel;
}

const severityOrder: Record<PlanningPriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

const reasonOrder: Record<PlanningPriorityReasonCode, number> = {
  STABILITY_RATING: 1,
  TRAFFIC_SAFETY_RATING: 2,
  INSPECTION_OVERDUE: 3,
  IMMEDIATE_URGENCY: 4,
  DURABILITY_RATING: 5,
  SHORT_TERM_URGENCY: 6,
  CONDITION_DETERIORATING: 7,
  LONG_UNRESOLVED: 8,
  INSPECTION_DUE_SOON: 9,
  MEDIUM_TERM_URGENCY: 10,
  NETWORK_CRITICALITY: 11,
  HIGH_ENVIRONMENTAL_EXPOSURE: 12
};

export function deriveMaintenancePriority(
  input: MaintenancePriorityInput
): PlanningPriority {
  const reasons: PriorityReasonDefinition[] = [];

  addRatingReason(reasons, "STABILITY_RATING", "Standsicherheit", input.maximumStability);
  addRatingReason(
    reasons,
    "TRAFFIC_SAFETY_RATING",
    "Verkehrssicherheit",
    input.maximumTrafficSafety
  );
  addDurabilityReason(reasons, input.maximumDurability);
  addUrgencyReason(reasons, input.urgency);
  addAgeReason(reasons, input.recommendationSourceDate, input.asOf);
  addInspectionReason(reasons, input.inspectionStatus);
  addConditionReason(reasons, input.conditionDelta);
  addNetworkReason(reasons, input);
  addEnvironmentalReason(reasons, input.hasEnvironmentalExposure);

  reasons.sort((left, right) => {
    const severityDifference =
      severityOrder[right.severity] - severityOrder[left.severity];
    return severityDifference !== 0
      ? severityDifference
      : reasonOrder[left.code] - reasonOrder[right.code];
  });

  return {
    level: reasons[0]?.severity ?? "LOW",
    policyVersion: "maintenance-priority-v1",
    reasons
  };
}

function addRatingReason(
  reasons: PriorityReasonDefinition[],
  code: "STABILITY_RATING" | "TRAFFIC_SAFETY_RATING",
  label: string,
  rating: number | null
): void {
  if (rating === null || rating < 2) {
    return;
  }
  reasons.push({
    code,
    severity: rating >= 3 ? "CRITICAL" : "HIGH",
    label: `${label} S/V/D ${String(rating)}`,
    detail: `The highest unresolved linked finding has ${label} rating ${String(rating)}.`
  });
}

function addDurabilityReason(
  reasons: PriorityReasonDefinition[],
  rating: number | null
): void {
  if (rating === null || rating < 2) {
    return;
  }
  reasons.push({
    code: "DURABILITY_RATING",
    severity: rating >= 3 ? "HIGH" : "MEDIUM",
    label: `Dauerhaftigkeit S/V/D ${String(rating)}`,
    detail: `The highest unresolved linked finding has Dauerhaftigkeit rating ${String(rating)}.`
  });
}

function addUrgencyReason(
  reasons: PriorityReasonDefinition[],
  urgency: string | null
): void {
  const normalized = normalizeText(urgency);
  if (normalized === null) {
    return;
  }
  if (containsAny(normalized, ["sofort", "umgehend", "unverzuglich", "immediate"])) {
    reasons.push({
      code: "IMMEDIATE_URGENCY",
      severity: "CRITICAL",
      label: "Immediate recommendation",
      detail: `The source recommendation urgency is “${String(urgency)}”.`
    });
    return;
  }
  if (containsAny(normalized, ["kurzfristig", "dringend", "short term", "short-term"])) {
    reasons.push({
      code: "SHORT_TERM_URGENCY",
      severity: "HIGH",
      label: "Short-term recommendation",
      detail: `The source recommendation urgency is “${String(urgency)}”.`
    });
    return;
  }
  if (containsAny(normalized, ["mittelfristig", "medium term", "medium-term"])) {
    reasons.push({
      code: "MEDIUM_TERM_URGENCY",
      severity: "MEDIUM",
      label: "Medium-term recommendation",
      detail: `The source recommendation urgency is “${String(urgency)}”.`
    });
  }
}

function addAgeReason(
  reasons: PriorityReasonDefinition[],
  sourceDate: string | null,
  asOf: string
): void {
  if (sourceDate === null) {
    return;
  }
  const ageYears = completedYears(sourceDate, asOf);
  if (ageYears < 2) {
    return;
  }
  reasons.push({
    code: "LONG_UNRESOLVED",
    severity: ageYears >= 5 ? "HIGH" : "MEDIUM",
    label: `Unresolved for ${String(ageYears)} years`,
    detail: `The recommendation is linked to inspection evidence dated ${sourceDate}.`
  });
}

function addInspectionReason(
  reasons: PriorityReasonDefinition[],
  status: InspectionDueStatus
): void {
  if (status === "OVERDUE") {
    reasons.push({
      code: "INSPECTION_OVERDUE",
      severity: "CRITICAL",
      label: "Inspection overdue",
      detail: "The latest known inspection cycle has passed its due date."
    });
  } else if (status === "DUE_SOON") {
    reasons.push({
      code: "INSPECTION_DUE_SOON",
      severity: "MEDIUM",
      label: "Inspection due soon",
      detail: "The latest known inspection cycle is due within 180 days."
    });
  }
}

function addConditionReason(
  reasons: PriorityReasonDefinition[],
  conditionDelta: string | null
): void {
  if (conditionDelta === null || Number(conditionDelta) < 0.1) {
    return;
  }
  reasons.push({
    code: "CONDITION_DETERIORATING",
    severity: "HIGH",
    label: "Condition deteriorating",
    detail: `The latest condition score is ${conditionDelta} points worse than the preceding score; lower is better.`
  });
}

function addNetworkReason(
  reasons: PriorityReasonDefinition[],
  input: MaintenancePriorityInput
): void {
  if (input.networkBand === null || input.networkBand === "LOW") {
    return;
  }
  const parts = [
    input.dailyTraffic === null
      ? null
      : `${input.dailyTraffic.toLocaleString("en-US")} vehicles/day`,
    input.heavyVehicleDaily === null
      ? null
      : `${input.heavyVehicleDaily.toLocaleString("en-US")} HGV/day`,
    input.additionalDistanceKm === null ? null : `+${input.additionalDistanceKm} km detour`,
    input.alternativeCrossingCount === null
      ? null
      : input.alternativeCrossingCount === 0
        ? "no alternative crossing"
        : `${String(input.alternativeCrossingCount)} alternative crossings`,
    input.extraVehicleKmPerDay === null
      ? null
      : `${Math.round(input.extraVehicleKmPerDay).toLocaleString("en-US")} extra vehicle-km/day if closed`
  ].filter((part): part is string => part !== null);
  reasons.push({
    code: "NETWORK_CRITICALITY",
    severity: input.networkBand === "HIGH" ? "HIGH" : "MEDIUM",
    label:
      input.networkBand === "HIGH"
        ? "High network consequence"
        : "Moderate network consequence",
    detail:
      parts.length === 0
        ? "Seeded network metrics place this structure above the low-consequence band."
        : parts.join(", ") + "."
  });
}

function addEnvironmentalReason(
  reasons: PriorityReasonDefinition[],
  hasEnvironmentalExposure: boolean
): void {
  if (!hasEnvironmentalExposure) {
    return;
  }
  reasons.push({
    code: "HIGH_ENVIRONMENTAL_EXPOSURE",
    severity: "MEDIUM",
    label: "Climate-driven damage watch",
    detail:
      "Open durability damage coincides with freeze/thaw, heavy rain, or de-icing exposure from the seeded climate record."
  });
}

function normalizeText(value: string | null): string | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("de-DE");
}

function containsAny(value: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

function completedYears(from: string, to: string): number {
  const fromDate = parseIsoDate(from);
  const toDate = parseIsoDate(to);
  let years = toDate.getUTCFullYear() - fromDate.getUTCFullYear();
  if (
    toDate.getUTCMonth() < fromDate.getUTCMonth() ||
    (toDate.getUTCMonth() === fromDate.getUTCMonth() &&
      toDate.getUTCDate() < fromDate.getUTCDate())
  ) {
    years -= 1;
  }
  return Math.max(0, years);
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
