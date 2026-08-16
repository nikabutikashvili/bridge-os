import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { components } from "./components.js";
import { documentExtractionRuns, documents } from "./documents.js";
import {
  evidenceReviewStateEnum,
  extractionMethodEnum,
  provenanceKindEnum
} from "./enums.js";
import { findings } from "./findings.js";
import { historicalWorks } from "./historical-work.js";
import { inspections } from "./inspections.js";
import { recommendations } from "./recommendations.js";
import { trafficObservations } from "./traffic.js";

export const sourceEvidence = pgTable(
  "source_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict", onUpdate: "cascade" }),
    extractionRunId: uuid("extraction_run_id").references(
      () => documentExtractionRuns.id,
      { onDelete: "restrict", onUpdate: "cascade" }
    ),
    pageNumber: integer("page_number"),
    sourceExcerpt: text("source_excerpt"),
    boundingBoxX: numeric("bounding_box_x", { precision: 8, scale: 6 }),
    boundingBoxY: numeric("bounding_box_y", { precision: 8, scale: 6 }),
    boundingBoxWidth: numeric("bounding_box_width", { precision: 8, scale: 6 }),
    boundingBoxHeight: numeric("bounding_box_height", { precision: 8, scale: 6 }),
    extractionConfidence: numeric("extraction_confidence", { precision: 4, scale: 3 }),
    extractionMethod: extractionMethodEnum("extraction_method").notNull(),
    reviewState: evidenceReviewStateEnum("review_state"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("source_evidence_document_page_idx").on(table.documentId, table.pageNumber),
    index("source_evidence_extraction_run_idx").on(table.extractionRunId),
    check(
      "source_evidence_positive_page_number",
      sql`${table.pageNumber} is null or ${table.pageNumber} > 0`
    ),
    check(
      "source_evidence_excerpt_not_blank",
      sql`${table.sourceExcerpt} is null or btrim(${table.sourceExcerpt}) <> ''`
    ),
    check(
      "source_evidence_bounding_box_complete",
      sql`(
        ${table.boundingBoxX} is null and ${table.boundingBoxY} is null
        and ${table.boundingBoxWidth} is null and ${table.boundingBoxHeight} is null
      ) or (
        ${table.boundingBoxX} is not null and ${table.boundingBoxY} is not null
        and ${table.boundingBoxWidth} is not null and ${table.boundingBoxHeight} is not null
        and ${table.pageNumber} is not null
      )`
    ),
    check(
      "source_evidence_bounding_box_range",
      sql`${table.boundingBoxX} is null or (
        ${table.boundingBoxX} between 0 and 1
        and ${table.boundingBoxY} between 0 and 1
        and ${table.boundingBoxWidth} > 0 and ${table.boundingBoxWidth} <= 1
        and ${table.boundingBoxHeight} > 0 and ${table.boundingBoxHeight} <= 1
        and ${table.boundingBoxX} + ${table.boundingBoxWidth} <= 1
        and ${table.boundingBoxY} + ${table.boundingBoxHeight} <= 1
      )`
    ),
    check(
      "source_evidence_confidence_range",
      sql`${table.extractionConfidence} is null or ${table.extractionConfidence} between 0 and 1`
    ),
    check(
      "source_evidence_run_method",
      sql`${table.extractionRunId} is null or ${table.extractionMethod} = 'MODEL_EXTRACTION'`
    ),
    check(
      "source_evidence_review_state",
      sql`(${table.reviewState} is null or ${table.extractionMethod} = 'MODEL_EXTRACTION')
        and (${table.extractionRunId} is null or ${table.reviewState} is not null)`
    )
  ]
);

export const bridgeEvidence = pgTable(
  "bridge_evidence",
  {
    bridgeId: uuid("bridge_id")
      .notNull()
      .references(() => bridges.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.bridgeId, table.evidenceId, table.fieldName] }),
    index("bridge_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "bridge_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'externalStructureNumber', 'name', 'road', 'location.countryCode',
        'location.federalState', 'location.district', 'location.municipality',
        'location.locality', 'location.postalCode', 'location.stationing',
        'location.crossedFeature', 'location.latitude', 'location.longitude',
        'owner', 'loadBearingResponsibility', 'responsibleAuthority', 'maintenanceOffice'
      )`
    ),
    check(
      "bridge_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const partialStructureEvidence = pgTable(
  "partial_structure_evidence",
  {
    partialStructureId: uuid("partial_structure_id")
      .notNull()
      .references(() => partialStructures.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.partialStructureId, table.evidenceId, table.fieldName] }),
    index("partial_structure_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "partial_structure_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'externalPartialStructureNumber', 'name', 'constructionYear', 'structureType',
        'structuralSystem', 'lengthM', 'widthM', 'areaSqM', 'clearHeightM', 'spanCount'
      )`
    ),
    check(
      "partial_structure_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const componentEvidence = pgTable(
  "component_evidence",
  {
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.componentId, table.evidenceId, table.fieldName] }),
    index("component_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "component_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'type', 'name', 'location', 'material', 'constructionYear', 'installYear',
        'additionalProperties'
      )`
    ),
    check(
      "component_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const inspectionEvidence = pgTable(
  "inspection_evidence",
  {
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.inspectionId, table.evidenceId, table.fieldName] }),
    index("inspection_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "inspection_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'type', 'inspectedOn', 'inspector', 'conditionScore', 'cycleMonths'
      )`
    ),
    check(
      "inspection_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const findingEvidence = pgTable(
  "finding_evidence",
  {
    findingId: uuid("finding_id")
      .notNull()
      .references(() => findings.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.findingId, table.evidenceId, table.fieldName] }),
    index("finding_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "finding_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'sourceIdentifier', 'defectType', 'description', 'location', 'extent',
        'dimensionLength', 'dimensionWidth', 'dimensionDepth', 'dimensionUnit',
        'quantity', 'quantityUnit', 'stabilityRating', 'trafficSafetyRating',
        'durabilityRating', 'status', 'componentId'
      )`
    ),
    check(
      "finding_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const recommendationEvidence = pgTable(
  "recommendation_evidence",
  {
    recommendationId: uuid("recommendation_id")
      .notNull()
      .references(() => recommendations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.recommendationId, table.evidenceId, table.fieldName] }),
    index("recommendation_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "recommendation_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'workType', 'description', 'urgency', 'quantity', 'unit',
        'sourceEstimatedCost', 'sourceEstimatedCostCurrency', 'targetYear', 'plannedYear', 'status'
      )`
    ),
    check(
      "recommendation_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const historicalWorkEvidence = pgTable(
  "historical_work_evidence",
  {
    historicalWorkId: uuid("historical_work_id")
      .notNull()
      .references(() => historicalWorks.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.historicalWorkId, table.evidenceId, table.fieldName] }),
    index("historical_work_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "historical_work_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'partialStructureId', 'type', 'title', 'reason', 'contractor', 'client',
        'startedOn', 'endedOn', 'quantity', 'unit', 'contractAmount', 'finalAmount', 'currency'
      )`
    ),
    check(
      "historical_work_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);

export const trafficObservationEvidence = pgTable(
  "traffic_observation_evidence",
  {
    trafficObservationId: uuid("traffic_observation_id")
      .notNull()
      .references(() => trafficObservations.id, { onDelete: "cascade", onUpdate: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => sourceEvidence.id, { onDelete: "restrict", onUpdate: "cascade" }),
    fieldName: text("field_name").notNull(),
    kind: provenanceKindEnum("kind").notNull(),
    derivationMethod: text("derivation_method"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.trafficObservationId, table.evidenceId, table.fieldName] }),
    index("traffic_observation_evidence_evidence_id_idx").on(table.evidenceId),
    check(
      "traffic_observation_evidence_field_name_valid",
      sql`${table.fieldName} in (
        '$', 'observationYear', 'observedOn', 'dailyTraffic', 'truckSharePercent',
        'sourceDescription'
      )`
    ),
    check(
      "traffic_observation_evidence_derivation_valid",
      sql`(${table.kind} = 'SOURCE_FACT' and ${table.derivationMethod} is null)
        or (${table.kind} = 'DERIVED' and nullif(btrim(${table.derivationMethod}), '') is not null)`
    )
  ]
);
