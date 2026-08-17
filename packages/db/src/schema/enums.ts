import { pgEnum } from "drizzle-orm/pg-core";

export const bridgeDataOriginEnum = pgEnum("bridge_data_origin", [
  "EXTRACTED",
  "USER_ENTERED",
  "DEMO_FIXTURE"
]);

export const inspectionTypeEnum = pgEnum("inspection_type", [
  "MAIN",
  "SIMPLE",
  "SPECIAL",
  "OTHER"
]);

export const findingStatusEnum = pgEnum("finding_status", [
  "OPEN",
  "MONITORING",
  "RESOLVED",
  "DISMISSED"
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "OPEN",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
]);

export const plannedInterventionStatusEnum = pgEnum(
  "planned_intervention_status",
  [
    "PLANNED",
    "BUDGETED",
    "TENDER_PREPARATION",
    "TENDERED_READY",
    "IN_PROGRESS",
    "COMPLETED"
  ]
);

export const interventionEstimateSourceEnum = pgEnum(
  "intervention_estimate_source",
  ["USER_PLANNING", "EXTERNAL_ENRICHED"]
);

export const interventionEstimateStatusEnum = pgEnum(
  "intervention_estimate_status",
  ["DRAFT", "REVIEWED"]
);

export const budgetScenarioStatusEnum = pgEnum("budget_scenario_status", [
  "DRAFT",
  "ADOPTED"
]);

export const budgetScenarioAssignmentSourceEnum = pgEnum(
  "budget_scenario_assignment_source",
  ["SEEDED", "AUTO_FILL", "USER_OVERRIDE"]
);

export const workPackageStatusEnum = pgEnum("work_package_status", [
  "DRAFT",
  "READY_FOR_REVIEW",
  "ARCHIVED"
]);

export const documentStatusEnum = pgEnum("document_status", [
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED"
]);

export const documentProcessingStatusEnum = pgEnum("document_processing_status", [
  "UPLOADED",
  "PARSING",
  "PARSED",
  "EXTRACTION_PENDING",
  "EXTRACTED",
  "FAILED"
]);

export const documentPageTextSourceEnum = pgEnum("document_page_text_source", [
  "PDF_TEXT",
  "OCR"
]);

export const extractionRunStatusEnum = pgEnum("extraction_run_status", [
  "PENDING",
  "CLASSIFYING",
  "EXTRACTING",
  "VALIDATING",
  "PERSISTING",
  "SUCCEEDED",
  "FAILED"
]);

export const extractionEntityKindEnum = pgEnum("extraction_entity_kind", [
  "BRIDGE",
  "PARTIAL_STRUCTURE",
  "COMPONENT",
  "INSPECTION",
  "FINDING",
  "RECOMMENDATION",
  "HISTORICAL_WORK",
  "TRAFFIC_OBSERVATION"
]);

export const extractionInvocationStatusEnum = pgEnum(
  "extraction_invocation_status",
  ["RUNNING", "SUCCEEDED", "FAILED"]
);

export const extractionMethodEnum = pgEnum("extraction_method", [
  "MANUAL",
  "TEXT_EXTRACTION",
  "OCR",
  "MODEL_EXTRACTION",
  "IMPORT",
  "OTHER"
]);

export const evidenceReviewStateEnum = pgEnum("evidence_review_state", [
  "AUTOMATICALLY_EXTRACTED",
  "HUMAN_CONFIRMED",
  "HUMAN_REJECTED"
]);

export const provenanceKindEnum = pgEnum("provenance_kind", ["SOURCE_FACT", "DERIVED"]);

export const trafficObservationSourceEnum = pgEnum("traffic_observation_source", [
  "DOCUMENT",
  "EXTERNAL_ENRICHED"
]);

export const environmentalMetricSourceEnum = pgEnum("environmental_metric_source", [
  "OPEN_METEO"
]);
