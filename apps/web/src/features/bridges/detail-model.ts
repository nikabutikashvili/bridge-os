import type {
  BridgeHistoryResponse,
  BridgeInspectionsResponse,
  BridgeRecommendationsResponse
} from "@bridge-os/contracts";

export const bridgeDetailTabs = [
  "overview",
  "inspections",
  "findings",
  "recommendations",
  "technical",
  "documents"
] as const;

export type BridgeDetailTab = (typeof bridgeDetailTabs)[number];

export interface ConditionSeriesPoint {
  readonly date: string;
  readonly id: string;
  readonly inspectionType: BridgeInspectionsResponse["data"][number]["type"];
  readonly score: number;
}

export function parseBridgeDetailTab(
  value: string | string[] | undefined
): BridgeDetailTab {
  const scalar = Array.isArray(value) ? value[0] : value;
  return bridgeDetailTabs.includes(scalar as BridgeDetailTab)
    ? (scalar as BridgeDetailTab)
    : "overview";
}

export function bridgeDetailHref(
  bridgeId: string,
  tab: BridgeDetailTab
): string {
  return tab === "overview"
    ? `/bridges/${bridgeId}`
    : `/bridges/${bridgeId}?tab=${tab}`;
}

export function buildConditionSeries(
  inspections: BridgeInspectionsResponse["data"]
): ConditionSeriesPoint[] {
  return inspections
    .flatMap((inspection) => {
      if (inspection.inspectedOn === null || inspection.conditionScore === null) {
        return [];
      }
      const score = Number(inspection.conditionScore);
      if (!Number.isFinite(score) || score < 1 || score > 4) {
        return [];
      }
      return [
        {
          date: inspection.inspectedOn,
          id: inspection.id,
          inspectionType: inspection.type,
          score
        }
      ];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function currentRecommendations(
  recommendations: BridgeRecommendationsResponse["data"]
): BridgeRecommendationsResponse["data"] {
  const currentStatuses = new Set([
    "OPEN",
    "APPROVED",
    "SCHEDULED",
    "IN_PROGRESS"
  ]);
  return recommendations.filter(
    (recommendation) =>
      recommendation.status !== null && currentStatuses.has(recommendation.status)
  );
}

export function relevantTimelineEvents(
  history: BridgeHistoryResponse["data"]
): Extract<
    BridgeHistoryResponse["data"][number],
    { readonly kind: "HISTORICAL_WORK" | "INSPECTION" }
  >[] {
  return history.filter(
    (
      event
    ): event is Extract<
      BridgeHistoryResponse["data"][number],
      { readonly kind: "HISTORICAL_WORK" | "INSPECTION" }
    > => event.kind === "INSPECTION" || event.kind === "HISTORICAL_WORK"
  );
}
