import type { ExtractablePageCategory } from "@bridge-os/contracts";

export const extractionPipelineConfig = {
  pipelineVersion: "bauwerksbuch-extraction.v7",
  schemaVersion: "bauwerksbuch-section-contracts.v1",
  temperature: 0,
  maximumPagesPerSectionInvocation: 3,
  maximumSectionPages: 16,
  maximumPagesByCategory: {
    IDENTITY_OVERVIEW: 3,
    STRUCTURE_GEOMETRY: 3,
    COMPONENTS_MATERIALS: 3,
    INSPECTIONS: 16,
    FINDINGS_DAMAGE: 4,
    RECOMMENDATIONS: 16,
    HISTORICAL_WORKS_COSTS: 3,
    TRAFFIC_NETWORK: 3
  } satisfies Record<ExtractablePageCategory, number>,
  classificationPromptVersion: "page-classification.de.v4",
  sectionPromptVersions: {
    IDENTITY_OVERVIEW: "identity-overview.de.v3",
    STRUCTURE_GEOMETRY: "structure-geometry.de.v2",
    COMPONENTS_MATERIALS: "components-materials.de.v1",
    INSPECTIONS: "inspections.de.v4",
    FINDINGS_DAMAGE: "findings-damage.de.v3",
    RECOMMENDATIONS: "recommendations.de.v4",
    HISTORICAL_WORKS_COSTS: "historical-works-costs.de.v2",
    TRAFFIC_NETWORK: "traffic-network.de.v2"
  } satisfies Record<ExtractablePageCategory, string>
} as const;

export const extractionPolicy = {
  allowEngineeringConclusions: false,
  preserveMissingValues: true,
  requireSourceEvidence: true
} as const;
