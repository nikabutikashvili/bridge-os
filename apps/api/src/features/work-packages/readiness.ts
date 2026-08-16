import type {
  InspectionDueStatus,
  WorkPackageReadinessItem
} from "@bridge-os/contracts";

export interface WorkPackageReadinessInput {
  readonly hasCostEstimate: boolean;
  readonly hasDrawings: boolean;
  readonly hasQuantity: boolean;
  readonly hasSourceEvidence: boolean;
  readonly inspectionDueStatus: InspectionDueStatus | null;
  readonly trafficManagementRequirementsKnown: boolean;
}

export function deriveWorkPackageReadiness(
  input: WorkPackageReadinessInput
): WorkPackageReadinessItem[] {
  return [
    availability(
      "SOURCE_EVIDENCE_AVAILABLE",
      "Source evidence available",
      input.hasSourceEvidence,
      "Source-backed citations are attached to the draft.",
      "No source-backed citation is attached to the draft."
    ),
    availability(
      "QUANTITIES_KNOWN",
      "Quantities known",
      input.hasQuantity,
      "A scoped quantity and unit are recorded.",
      "Quantity or unit is missing and must be confirmed."
    ),
    currentInspection(input.inspectionDueStatus),
    availability(
      "COST_ESTIMATE_AVAILABLE",
      "Cost estimate available",
      input.hasCostEstimate,
      "A managerial planning estimate is recorded.",
      "A planning estimate is required; a source recommendation estimate alone is not sufficient."
    ),
    availability(
      "DRAWINGS_AVAILABLE",
      "Drawings available",
      input.hasDrawings,
      "At least one related drawing document is recorded.",
      "No related drawing document is recorded."
    ),
    availability(
      "TRAFFIC_MANAGEMENT_REQUIREMENTS_KNOWN",
      "Traffic-management requirements known",
      input.trafficManagementRequirementsKnown,
      "Traffic-management requirements are recorded.",
      "Traffic-management requirements have not been recorded."
    ),
    {
      code: "SITE_VERIFICATION_REQUIRED",
      label: "Site verification required",
      state: "REQUIRED",
      detail: "Site conditions must be verified before technical and procurement approval."
    }
  ];
}

function availability(
  code: WorkPackageReadinessItem["code"],
  label: string,
  available: boolean,
  availableDetail: string,
  missingDetail: string
): WorkPackageReadinessItem {
  return {
    code,
    label,
    state: available ? "AVAILABLE" : "MISSING",
    detail: available ? availableDetail : missingDetail
  };
}

function currentInspection(
  status: InspectionDueStatus | null
): WorkPackageReadinessItem {
  if (status === "CURRENT" || status === "DUE_SOON") {
    return {
      code: "CURRENT_INSPECTION_AVAILABLE",
      label: "Current inspection available",
      state: "AVAILABLE",
      detail:
        status === "DUE_SOON"
          ? "A current inspection is recorded, with the next cycle due soon."
          : "A current inspection is recorded within its known cycle."
    };
  }
  return {
    code: "CURRENT_INSPECTION_AVAILABLE",
    label: "Current inspection available",
    state: "MISSING",
    detail:
      status === "OVERDUE"
        ? "The recorded inspection cycle is overdue."
        : "Current inspection status cannot be confirmed from recorded dates and cycle data."
  };
}
