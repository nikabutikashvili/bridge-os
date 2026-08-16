import {
  workPackageSnapshotSchema,
  type WorkPackageSnapshot
} from "@bridge-os/contracts";

import { deriveWorkPackageReadiness } from "./readiness.js";

type Asset = WorkPackageSnapshot["asset"];
type Component = WorkPackageSnapshot["scope"]["components"][number];
type Finding = WorkPackageSnapshot["scope"]["findings"][number];
type Inspection = WorkPackageSnapshot["evidence"]["sourceInspections"][number];
type LatestInspection = WorkPackageSnapshot["evidence"]["latestInspection"];
type Citation = WorkPackageSnapshot["evidence"]["citations"][number];
type Document = WorkPackageSnapshot["evidence"]["documents"][number];
type Traffic = WorkPackageSnapshot["operationalContext"]["traffic"];
type Money = NonNullable<WorkPackageSnapshot["commercialPlanning"]["planningEstimate"]>;
type Quantity = NonNullable<WorkPackageSnapshot["scope"]["quantity"]>;

export interface WorkPackageGenerationInput {
  readonly generatedAt: string;
  readonly asset: Asset;
  readonly intervention: {
    readonly id: string;
    readonly workType: string;
    readonly plannedYear: number;
    readonly quantity: Quantity | null;
    readonly planningEstimate: Money | null;
    readonly estimateSource: WorkPackageSnapshot["commercialPlanning"]["estimateSource"];
    readonly estimateStatus: WorkPackageSnapshot["commercialPlanning"]["estimateStatus"];
  };
  readonly recommendation: {
    readonly id: string;
    readonly description: string | null;
    readonly urgency: string | null;
    readonly quantity: Quantity | null;
    readonly sourceEstimatedCost: Money | null;
  };
  readonly components: readonly Component[];
  readonly findings: readonly Finding[];
  readonly sourceInspections: readonly Inspection[];
  readonly latestInspection: LatestInspection;
  readonly traffic: Traffic;
  readonly citations: readonly Citation[];
  readonly documents: readonly Document[];
  readonly technicalContext: WorkPackageSnapshot["technicalContext"];
  readonly inspectionAccessEquipment: string | null;
  readonly knownConstraints: readonly string[];
  readonly trafficManagementRequirements: string | null;
}

export interface GeneratedWorkPackage {
  readonly title: string;
  readonly snapshot: WorkPackageSnapshot;
}

export function generateWorkPackage(
  input: WorkPackageGenerationInput
): GeneratedWorkPackage {
  const quantity = input.intervention.quantity ?? input.recommendation.quantity;
  const quantitySource =
    input.intervention.quantity !== null
      ? "PLANNED_INTERVENTION"
      : input.recommendation.quantity !== null
        ? "SOURCE_RECOMMENDATION"
        : null;
  const readiness = deriveWorkPackageReadiness({
    hasCostEstimate: input.intervention.planningEstimate !== null,
    hasDrawings: input.documents.some((document) => document.isDrawing),
    hasQuantity: quantity !== null,
    hasSourceEvidence: input.citations.some(
      ({ citation }) => citation.kind === "SOURCE_FACT"
    ),
    inspectionDueStatus: input.latestInspection?.dueStatus ?? null,
    trafficManagementRequirementsKnown:
      input.trafficManagementRequirements !== null
  });
  const snapshot = workPackageSnapshotSchema.parse({
    version: 1,
    generatedAt: input.generatedAt,
    disclaimer: "Planning draft — requires technical and procurement review.",
    asset: input.asset,
    scope: {
      interventionId: input.intervention.id,
      recommendationId: input.recommendation.id,
      workType: input.intervention.workType,
      description: input.recommendation.description,
      urgency: input.recommendation.urgency,
      plannedYear: input.intervention.plannedYear,
      quantity,
      quantitySource,
      components: input.components,
      findings: input.findings
    },
    technicalContext: input.technicalContext,
    operationalContext: {
      traffic: input.traffic,
      inspectionAccessEquipment: input.inspectionAccessEquipment,
      knownConstraints: input.knownConstraints,
      trafficManagementRequirements: input.trafficManagementRequirements
    },
    evidence: {
      sourceInspections: input.sourceInspections,
      latestInspection: input.latestInspection,
      citations: input.citations,
      documents: input.documents
    },
    commercialPlanning: {
      plannedYear: input.intervention.plannedYear,
      planningEstimate: input.intervention.planningEstimate,
      estimateSource: input.intervention.estimateSource,
      estimateStatus: input.intervention.estimateStatus,
      sourceRecommendationEstimate:
        input.recommendation.sourceEstimatedCost
    },
    readiness
  });
  const assetLabel =
    input.asset.bridge.externalStructureNumber ??
    input.asset.bridge.name ??
    "Unidentified bridge";
  return {
    title: `${input.intervention.workType} · ${assetLabel}`,
    snapshot
  };
}

export function summarizeReadiness(
  readiness: WorkPackageSnapshot["readiness"]
): { available: number; missing: number; required: number; total: number } {
  return {
    available: readiness.filter((item) => item.state === "AVAILABLE").length,
    missing: readiness.filter((item) => item.state === "MISSING").length,
    required: readiness.filter((item) => item.state === "REQUIRED").length,
    total: readiness.length
  };
}
