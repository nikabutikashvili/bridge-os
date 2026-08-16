import type { ExtractablePageCategory } from "@bridge-os/contracts";

import {
  normalizeFindingStatus,
  normalizeInspectionType,
  normalizeRecommendationStatus,
  normalizeSvdRating
} from "./normalize-values.js";

export function repairSectionOutput(
  category: string,
  raw: unknown
): unknown {
  if (raw === null || typeof raw !== "object") {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  switch (category) {
    case "INSPECTIONS":
      return repairArray(record, "inspections", repairInspectionItem);
    case "FINDINGS_DAMAGE":
      return repairArray(record, "findings", repairFindingItem);
    case "RECOMMENDATIONS":
      return repairArray(record, "recommendations", repairRecommendationItem);
    default:
      return raw;
  }
}

export function emptySectionOutput(category: ExtractablePageCategory): unknown {
  switch (category) {
    case "IDENTITY_OVERVIEW":
      return { category, bridge: null };
    case "STRUCTURE_GEOMETRY":
      return { category, partialStructures: [] };
    case "COMPONENTS_MATERIALS":
      return { category, components: [] };
    case "INSPECTIONS":
      return { category, inspections: [] };
    case "FINDINGS_DAMAGE":
      return { category, findings: [] };
    case "RECOMMENDATIONS":
      return { category, recommendations: [] };
    case "HISTORICAL_WORKS_COSTS":
      return { category, historicalWorks: [] };
    case "TRAFFIC_NETWORK":
      return { category, trafficObservations: [] };
  }
}

function repairArray(
  record: Record<string, unknown>,
  key: string,
  repairItem: (item: unknown) => unknown
): Record<string, unknown> {
  const items = record[key];
  if (!Array.isArray(items)) {
    return record;
  }
  return {
    ...record,
    [key]: items.flatMap((item) => {
      const repaired = repairItem(item);
      return repaired === null ? [] : [repaired];
    })
  };
}

function repairInspectionItem(item: unknown): unknown {
  const record = asRecord(item);
  if (record === null) {
    return null;
  }
  const type = coerceSourced(record["type"], normalizeInspectionType);
  const evidence = liftEvidence(record);
  if (evidence.length === 0) {
    return null;
  }
  return {
    ...record,
    evidence,
    type
  };
}

function repairFindingItem(item: unknown): unknown {
  const record = asRecord(item);
  if (record === null) {
    return null;
  }
  const evidence = liftEvidence(record);
  if (evidence.length === 0) {
    return null;
  }
  return {
    ...record,
    evidence,
    stabilityRating: coerceSourced(record["stabilityRating"], normalizeSvdRating),
    trafficSafetyRating: coerceSourced(
      record["trafficSafetyRating"],
      normalizeSvdRating
    ),
    durabilityRating: coerceSourced(record["durabilityRating"], normalizeSvdRating),
    status: coerceSourced(record["status"], normalizeFindingStatus)
  };
}

function repairRecommendationItem(item: unknown): unknown {
  const record = asRecord(item);
  if (record === null) {
    return null;
  }
  const evidence = liftEvidence(record);
  if (evidence.length === 0) {
    return null;
  }
  return {
    ...record,
    evidence,
    status: coerceSourced(record["status"], normalizeRecommendationStatus)
  };
}

function coerceSourced(
  field: unknown,
  normalize: (value: unknown) => unknown
): unknown {
  const record = asRecord(field);
  if (record === null) {
    return field;
  }
  const nextValue = normalize(record["value"]);
  if (nextValue === null) {
    return { evidence: [], value: null };
  }
  return { ...record, value: nextValue };
}

function liftEvidence(record: Record<string, unknown>): unknown[] {
  const direct = record["evidence"];
  if (Array.isArray(direct) && direct.length > 0) {
    return direct;
  }
  for (const value of Object.values(record)) {
    const field = asRecord(value);
    if (field === null) {
      continue;
    }
    const evidence = field["evidence"];
    if (Array.isArray(evidence) && evidence.length > 0) {
      return evidence;
    }
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
