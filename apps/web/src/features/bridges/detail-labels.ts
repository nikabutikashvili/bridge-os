import type {
  BridgeAttentionLevel,
  BridgeAttentionReason,
  InspectionDueStatus
} from "@bridge-os/contracts";

export type StatusTone = "critical" | "info" | "neutral" | "success" | "warning";

export function attentionTone(level: BridgeAttentionLevel): StatusTone {
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH" || level === "MEDIUM") return "warning";
  if (level === "ROUTINE") return "success";
  return "neutral";
}

export function attentionLabel(level: BridgeAttentionLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

export function attentionReasonLabel(reason: BridgeAttentionReason): string {
  const labels: Record<BridgeAttentionReason, string> = {
    DETERIORATING_CONDITION: "Condition has deteriorated since the prior inspection",
    DURABILITY_FINDING: "Durability finding rated 2 or higher",
    INSPECTION_DUE_SOON: "Inspection due within 180 days",
    MEDIUM_OR_HIGHER_RECOMMENDATION: "Medium-term or more urgent work remains open",
    MISSING_CRITICAL_DATA: "Critical inspection or condition data is missing",
    OPEN_FINDING: "An unresolved finding remains open",
    OPEN_RECOMMENDATION: "An unresolved recommendation remains open",
    OVERDUE_INSPECTION: "Inspection is overdue",
    STABILITY_FINDING: "Structural-safety finding rated 2 or higher",
    TRAFFIC_SAFETY_FINDING: "Traffic-safety finding rated 2 or higher"
  };
  return labels[reason];
}

export function inspectionDueLabel(status: InspectionDueStatus): string {
  const labels: Record<InspectionDueStatus, string> = {
    CURRENT: "Current",
    DUE_SOON: "Due soon",
    OVERDUE: "Overdue",
    UNKNOWN: "Due date unknown"
  };
  return labels[status];
}

export function inspectionDueTone(status: InspectionDueStatus): StatusTone {
  if (status === "OVERDUE") return "critical";
  if (status === "DUE_SOON") return "warning";
  if (status === "CURRENT") return "success";
  return "neutral";
}

export function inspectionTypeLabel(
  type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null
): string {
  const labels = {
    MAIN: "Main inspection",
    OTHER: "Other inspection",
    SIMPLE: "Simple inspection",
    SPECIAL: "Special inspection"
  } as const;
  return type === null ? "Type not recorded" : labels[type];
}

export function inspectionTypeGermanTerm(
  type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null
): string | undefined {
  const terms = {
    MAIN: "Hauptprüfung",
    OTHER: undefined,
    SIMPLE: "Einfache Prüfung",
    SPECIAL: "Sonderprüfung"
  } as const;
  return type === null ? undefined : terms[type];
}

export function inspectionTypeShortLabel(
  type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null
): string {
  const labels = {
    MAIN: "Main",
    OTHER: "Other",
    SIMPLE: "Simple",
    SPECIAL: "Special"
  } as const;
  return type === null ? "Unknown" : labels[type];
}

export function urgencyLabel(urgency: string | null): string {
  if (urgency === null) return "Urgency not recorded";
  const labels: Record<string, string> = {
    LANGFRISTIG: "Long term",
    MITTELFRISTIG: "Medium term",
    KURZFRISTIG: "Short term",
    SOFORT: "Immediate"
  };
  return labels[urgency.toUpperCase()] ?? urgency;
}

export function urgencyGermanTerm(urgency: string | null): string | undefined {
  return urgency === null ? undefined : urgency.toUpperCase();
}

export function recordStatusLabel(status: string | null): string {
  if (status === null) return "Status not recorded";
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function recordStatusTone(status: string | null): StatusTone {
  if (status === "COMPLETED" || status === "CLOSED" || status === "RESOLVED") {
    return "success";
  }
  if (status === "IN_PROGRESS" || status === "SCHEDULED" || status === "APPROVED") {
    return "info";
  }
  if (status === "OPEN" || status === "MONITORING") {
    return "warning";
  }
  return "neutral";
}

export function ratingLabel(rating: number | null): string {
  if (rating === null) return "Not recorded";
  const labels: Record<number, string> = {
    0: "No adverse rating",
    1: "Minor",
    2: "Notable",
    3: "Severe",
    4: "Critical"
  };
  return labels[rating] ?? "Outside expected range";
}

export function ratingTone(rating: number | null): StatusTone {
  if (rating === null) return "neutral";
  if (rating >= 3) return "critical";
  if (rating === 2) return "warning";
  return "success";
}
