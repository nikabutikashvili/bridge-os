import type {
  BridgeAttentionLevel,
  BridgeAttentionReason,
  BridgeConditionTrend,
  InspectionDueStatus
} from "@bridge-os/contracts";

interface BridgeAttentionInput {
  readonly conditionScore: string | null;
  readonly conditionTrend: BridgeConditionTrend;
  readonly highestRecommendationUrgencyRank: number;
  readonly inspectionStatus: InspectionDueStatus;
  readonly maximumDurability: number | null;
  readonly maximumStability: number | null;
  readonly maximumTrafficSafety: number | null;
  readonly openFindings: number;
  readonly openRecommendations: number;
  readonly hasEnvironmentalExposure: boolean;
  readonly hasHighNetworkConsequence: boolean;
}

interface BridgeAttention {
  readonly level: BridgeAttentionLevel;
  readonly reasons: BridgeAttentionReason[];
}

export function deriveBridgeAttention(
  input: BridgeAttentionInput
): BridgeAttention {
  const reasons: BridgeAttentionReason[] = [];

  if (input.inspectionStatus === "OVERDUE") {
    reasons.push("OVERDUE_INSPECTION");
  } else if (input.inspectionStatus === "DUE_SOON") {
    reasons.push("INSPECTION_DUE_SOON");
  }
  if ((input.maximumTrafficSafety ?? 0) >= 2) {
    reasons.push("TRAFFIC_SAFETY_FINDING");
  }
  if ((input.maximumStability ?? 0) >= 2) {
    reasons.push("STABILITY_FINDING");
  }
  if ((input.maximumDurability ?? 0) >= 2) {
    reasons.push("DURABILITY_FINDING");
  }
  if (input.hasEnvironmentalExposure) {
    reasons.push("ENVIRONMENTAL_EXPOSURE");
  }
  if (input.hasHighNetworkConsequence) {
    reasons.push("NETWORK_CRITICALITY");
  }
  if (input.conditionTrend === "DETERIORATING") {
    reasons.push("DETERIORATING_CONDITION");
  }
  if (input.highestRecommendationUrgencyRank >= 2) {
    reasons.push("MEDIUM_OR_HIGHER_RECOMMENDATION");
  } else if (input.openRecommendations > 0) {
    reasons.push("OPEN_RECOMMENDATION");
  }
  if (
    input.openFindings > 0 &&
    (input.maximumStability ?? 0) < 2 &&
    (input.maximumTrafficSafety ?? 0) < 2 &&
    (input.maximumDurability ?? 0) < 2
  ) {
    reasons.push("OPEN_FINDING");
  }
  if (input.inspectionStatus === "UNKNOWN" || input.conditionScore === null) {
    reasons.push("MISSING_CRITICAL_DATA");
  }

  return { level: attentionLevel(input), reasons };
}

function attentionLevel(input: BridgeAttentionInput): BridgeAttentionLevel {
  if (
    input.inspectionStatus === "OVERDUE" ||
    (input.maximumStability ?? 0) >= 3 ||
    (input.maximumTrafficSafety ?? 0) >= 3
  ) {
    return "CRITICAL";
  }
  if (
    (input.maximumStability ?? 0) >= 2 ||
    (input.maximumTrafficSafety ?? 0) >= 2 ||
    input.hasHighNetworkConsequence
  ) {
    return "HIGH";
  }
  if (
    input.inspectionStatus === "DUE_SOON" ||
    input.inspectionStatus === "UNKNOWN" ||
    input.conditionScore === null ||
    (input.maximumDurability ?? 0) >= 2 ||
    input.hasEnvironmentalExposure ||
    input.conditionTrend === "DETERIORATING" ||
    input.highestRecommendationUrgencyRank >= 2
  ) {
    return "MEDIUM";
  }
  if (input.openFindings > 0 || input.openRecommendations > 0) {
    return "LOW";
  }
  return "ROUTINE";
}
