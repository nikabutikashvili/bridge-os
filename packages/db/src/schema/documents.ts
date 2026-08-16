import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { bridges, partialStructures } from "./bridges.js";
import { auditColumns, type ScalarProperties } from "./common.js";
import {
  documentPageTextSourceEnum,
  documentProcessingStatusEnum,
  documentStatusEnum,
  extractionEntityKindEnum,
  extractionInvocationStatusEnum,
  extractionRunStatusEnum
} from "./enums.js";

export interface ExtractionResultSummaryValue {
  readonly bridgeAction: "CREATED" | "UPDATED" | "UNCHANGED";
  readonly componentsExtracted: number;
  readonly findingsExtracted: number;
  readonly historicalWorksExtracted: number;
  readonly inspectionsExtracted: number;
  readonly partialStructuresExtracted: number;
  readonly recommendationsExtracted: number;
  readonly trafficObservationsExtracted: number;
}

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bridgeId: uuid("bridge_id").references(() => bridges.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
    partialStructureId: uuid("partial_structure_id"),
    type: text("type").notNull(),
    originalFilename: text("original_filename").notNull(),
    status: documentStatusEnum("status").notNull(),
    checksumSha256: char("checksum_sha256", { length: 64 }),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    storageKey: text("storage_key"),
    photoStorageKey: text("photo_storage_key"),
    photoMimeType: text("photo_mime_type"),
    photoPageNumber: integer("photo_page_number"),
    photoByteSize: bigint("photo_byte_size", { mode: "number" }),
    metadata: jsonb("metadata").$type<ScalarProperties>(),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.partialStructureId, table.bridgeId],
      foreignColumns: [partialStructures.id, partialStructures.bridgeId],
      name: "documents_partial_structure_bridge_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    index("documents_bridge_id_idx").on(table.bridgeId),
    index("documents_partial_structure_id_idx").on(table.partialStructureId),
    index("documents_status_idx").on(table.status),
    uniqueIndex("documents_checksum_sha256_unique")
      .on(table.checksumSha256)
      .where(sql`${table.checksumSha256} is not null`),
    uniqueIndex("documents_storage_key_unique")
      .on(table.storageKey)
      .where(sql`${table.storageKey} is not null`),
    uniqueIndex("documents_photo_storage_key_unique")
      .on(table.photoStorageKey)
      .where(sql`${table.photoStorageKey} is not null`),
    check("documents_type_not_blank", sql`btrim(${table.type}) <> ''`),
    check(
      "documents_original_filename_not_blank",
      sql`btrim(${table.originalFilename}) <> ''`
    ),
    check(
      "documents_partial_structure_requires_bridge",
      sql`${table.partialStructureId} is null or ${table.bridgeId} is not null`
    ),
    check(
      "documents_metadata_object",
      sql`${table.metadata} is null or jsonb_typeof(${table.metadata}) = 'object'`
    ),
    check(
      "documents_checksum_sha256_valid",
      sql`${table.checksumSha256} is null or ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "documents_ingestion_metadata_complete",
      sql`(
        ${table.checksumSha256} is null and ${table.mimeType} is null
        and ${table.sizeBytes} is null and ${table.storageKey} is null
      ) or (
        ${table.checksumSha256} is not null and ${table.mimeType} is not null
        and ${table.sizeBytes} is not null and ${table.storageKey} is not null
      )`
    ),
    check(
      "documents_ingested_pdf_valid",
      sql`${table.mimeType} is null or (
        ${table.mimeType} = 'application/pdf'
        and ${table.sizeBytes} > 0
        and nullif(btrim(${table.storageKey}), '') is not null
      )`
    ),
    check(
      "documents_photo_complete",
      sql`(
        ${table.photoStorageKey} is null
        and ${table.photoMimeType} is null
        and ${table.photoPageNumber} is null
        and ${table.photoByteSize} is null
      ) or (
        nullif(btrim(${table.photoStorageKey}), '') is not null
        and ${table.photoMimeType} = 'image/jpeg'
        and ${table.photoPageNumber} > 0
        and ${table.photoByteSize} > 0
      )`
    )
  ]
);

export const documentProcessingRuns = pgTable(
  "document_processing_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade", onUpdate: "cascade" }),
    status: documentProcessingStatusEnum("status").notNull(),
    parser: text("parser"),
    pageCount: integer("page_count"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    parsingStartedAt: timestamp("parsing_started_at", { withTimezone: true }),
    parsingCompletedAt: timestamp("parsing_completed_at", { withTimezone: true }),
    ...auditColumns()
  },
  (table) => [
    index("document_processing_runs_document_created_idx").on(
      table.documentId,
      table.createdAt
    ),
    index("document_processing_runs_status_idx").on(table.status),
    check(
      "document_processing_runs_page_count_valid",
      sql`${table.pageCount} is null or ${table.pageCount} >= 0`
    ),
    check(
      "document_processing_runs_error_shape",
      sql`(
        ${table.status} = 'FAILED'
        and nullif(btrim(${table.errorCode}), '') is not null
        and nullif(btrim(${table.errorMessage}), '') is not null
      ) or (
        ${table.status} <> 'FAILED'
        and ${table.errorCode} is null
        and ${table.errorMessage} is null
      )`
    ),
    check(
      "document_processing_runs_timing_shape",
      sql`(
        ${table.status} = 'UPLOADED'
        and ${table.parsingStartedAt} is null
        and ${table.parsingCompletedAt} is null
        and ${table.pageCount} is null
      ) or (
        ${table.status} = 'PARSING'
        and ${table.parsingStartedAt} is not null
        and ${table.parsingCompletedAt} is null
        and ${table.pageCount} is null
      ) or (
        ${table.status} in ('PARSED', 'EXTRACTION_PENDING', 'EXTRACTED')
        and ${table.parsingStartedAt} is not null
        and ${table.parsingCompletedAt} is not null
        and ${table.pageCount} is not null
      ) or ${table.status} = 'FAILED'`
    )
  ]
);

export const documentPages = pgTable(
  "document_pages",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade", onUpdate: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    textContent: text("text_content").notNull(),
    textSource: documentPageTextSourceEnum("text_source").default("PDF_TEXT").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.pageNumber] }),
    check("document_pages_positive_page_number", sql`${table.pageNumber} > 0`)
  ]
);

export const documentExtractionRuns = pgTable(
  "document_extraction_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade", onUpdate: "cascade" }),
    processingRunId: uuid("processing_run_id")
      .notNull()
      .references(() => documentProcessingRuns.id, {
        onDelete: "restrict",
        onUpdate: "cascade"
      }),
    retryOfRunId: uuid("retry_of_run_id"),
    attempt: integer("attempt").notNull(),
    status: extractionRunStatusEnum("status").notNull(),
    pipelineVersion: text("pipeline_version").notNull(),
    promptVersions: jsonb("prompt_versions")
      .$type<Record<string, string>>()
      .notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    temperature: numeric("temperature", { precision: 3, scale: 2 }).notNull(),
    outputBridgeId: uuid("output_bridge_id").references(() => bridges.id, {
      onDelete: "restrict",
      onUpdate: "cascade"
    }),
    durationMs: integer("duration_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCost: numeric("estimated_cost", { precision: 14, scale: 6 }),
    costCurrency: char("cost_currency", { length: 3 }),
    resultSummary: jsonb("result_summary").$type<ExtractionResultSummaryValue>(),
    errorStage: text("error_stage"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.retryOfRunId],
      foreignColumns: [table.id],
      name: "document_extraction_runs_retry_of_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("document_extraction_runs_id_document_unique").on(
      table.id,
      table.documentId
    ),
    uniqueIndex("document_extraction_runs_document_attempt_unique").on(
      table.documentId,
      table.attempt
    ),
    uniqueIndex("document_extraction_runs_one_active_per_document")
      .on(table.documentId)
      .where(
        sql`${table.status} in ('PENDING', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'PERSISTING')`
      ),
    index("document_extraction_runs_document_created_idx").on(
      table.documentId,
      table.createdAt
    ),
    index("document_extraction_runs_status_idx").on(table.status),
    check(
      "document_extraction_runs_attempt_positive",
      sql`${table.attempt} > 0`
    ),
    check(
      "document_extraction_runs_identity_not_blank",
      sql`nullif(btrim(${table.pipelineVersion}), '') is not null
        and nullif(btrim(${table.provider}), '') is not null
        and nullif(btrim(${table.model}), '') is not null`
    ),
    check(
      "document_extraction_runs_prompt_versions_object",
      sql`jsonb_typeof(${table.promptVersions}) = 'object'`
    ),
    check(
      "document_extraction_runs_temperature_range",
      sql`${table.temperature} between 0 and 0.20`
    ),
    check(
      "document_extraction_runs_usage_non_negative",
      sql`(${table.durationMs} is null or ${table.durationMs} >= 0)
        and (${table.inputTokens} is null or ${table.inputTokens} >= 0)
        and (${table.outputTokens} is null or ${table.outputTokens} >= 0)
        and (${table.estimatedCost} is null or ${table.estimatedCost} >= 0)`
    ),
    check(
      "document_extraction_runs_cost_pair",
      sql`(${table.estimatedCost} is null and ${table.costCurrency} is null)
        or (${table.estimatedCost} is not null and ${table.costCurrency} ~ '^[A-Z]{3}$')`
    ),
    check(
      "document_extraction_runs_result_summary_object",
      sql`${table.resultSummary} is null or jsonb_typeof(${table.resultSummary}) = 'object'`
    ),
    check(
      "document_extraction_runs_error_shape",
      sql`(${table.status} = 'FAILED'
        and nullif(btrim(${table.errorStage}), '') is not null
        and nullif(btrim(${table.errorCode}), '') is not null
        and nullif(btrim(${table.errorMessage}), '') is not null)
        or (${table.status} <> 'FAILED'
          and ${table.errorStage} is null
          and ${table.errorCode} is null
          and ${table.errorMessage} is null)`
    ),
    check(
      "document_extraction_runs_timing_shape",
      sql`(${table.status} = 'PENDING'
          and ${table.startedAt} is null and ${table.completedAt} is null)
        or (${table.status} in ('CLASSIFYING', 'EXTRACTING', 'VALIDATING', 'PERSISTING')
          and ${table.startedAt} is not null and ${table.completedAt} is null)
        or (${table.status} in ('SUCCEEDED', 'FAILED')
          and ${table.startedAt} is not null and ${table.completedAt} is not null)`
    ),
    check(
      "document_extraction_runs_success_output",
      sql`${table.status} <> 'SUCCEEDED' or ${table.outputBridgeId} is not null`
    )
  ]
);

export const extractionEntityBindings = pgTable(
  "extraction_entity_bindings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade", onUpdate: "cascade" }),
    entityKind: extractionEntityKindEnum("entity_kind").notNull(),
    sourceIdentityKey: text("source_identity_key").notNull(),
    entityId: uuid("entity_id").notNull(),
    latestRunId: uuid("latest_run_id").notNull(),
    lastAppliedFingerprint: char("last_applied_fingerprint", {
      length: 64
    }).notNull(),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.latestRunId, table.documentId],
      foreignColumns: [
        documentExtractionRuns.id,
        documentExtractionRuns.documentId
      ],
      name: "extraction_entity_bindings_run_document_fk"
    })
      .onDelete("restrict")
      .onUpdate("cascade"),
    unique("extraction_entity_bindings_document_kind_source_unique").on(
      table.documentId,
      table.entityKind,
      table.sourceIdentityKey
    ),
    unique("extraction_entity_bindings_document_kind_entity_unique").on(
      table.documentId,
      table.entityKind,
      table.entityId
    ),
    index("extraction_entity_bindings_entity_idx").on(
      table.entityKind,
      table.entityId
    ),
    index("extraction_entity_bindings_latest_run_idx").on(table.latestRunId),
    check(
      "extraction_entity_bindings_source_key_not_blank",
      sql`btrim(${table.sourceIdentityKey}) <> ''`
    ),
    check(
      "extraction_entity_bindings_fingerprint_valid",
      sql`${table.lastAppliedFingerprint} ~ '^[0-9a-f]{64}$'`
    )
  ]
);

export const documentExtractionInvocations = pgTable(
  "document_extraction_invocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").notNull(),
    documentId: uuid("document_id").notNull(),
    stage: text("stage").notNull(),
    category: text("category"),
    pageNumbers: integer("page_numbers").array().notNull(),
    promptVersion: text("prompt_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: extractionInvocationStatusEnum("status").notNull(),
    providerRequestId: text("provider_request_id"),
    durationMs: integer("duration_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCost: numeric("estimated_cost", { precision: 14, scale: 6 }),
    costCurrency: char("cost_currency", { length: 3 }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...auditColumns()
  },
  (table) => [
    foreignKey({
      columns: [table.runId, table.documentId],
      foreignColumns: [documentExtractionRuns.id, documentExtractionRuns.documentId],
      name: "document_extraction_invocations_run_document_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    unique("document_extraction_invocations_id_run_document_unique").on(
      table.id,
      table.runId,
      table.documentId
    ),
    index("document_extraction_invocations_run_idx").on(
      table.runId,
      table.createdAt
    ),
    check(
      "document_extraction_invocations_stage_shape",
      sql`(${table.stage} = 'PAGE_CLASSIFICATION' and ${table.category} is null)
        or (${table.stage} = 'SECTION_EXTRACTION'
          and nullif(btrim(${table.category}), '') is not null)`
    ),
    check(
      "document_extraction_invocations_pages_present",
      sql`cardinality(${table.pageNumbers}) > 0`
    ),
    check(
      "document_extraction_invocations_identity_not_blank",
      sql`nullif(btrim(${table.promptVersion}), '') is not null
        and nullif(btrim(${table.provider}), '') is not null
        and nullif(btrim(${table.model}), '') is not null`
    ),
    check(
      "document_extraction_invocations_usage_non_negative",
      sql`(${table.durationMs} is null or ${table.durationMs} >= 0)
        and (${table.inputTokens} is null or ${table.inputTokens} >= 0)
        and (${table.outputTokens} is null or ${table.outputTokens} >= 0)
        and (${table.estimatedCost} is null or ${table.estimatedCost} >= 0)`
    ),
    check(
      "document_extraction_invocations_cost_pair",
      sql`(${table.estimatedCost} is null and ${table.costCurrency} is null)
        or (${table.estimatedCost} is not null and ${table.costCurrency} ~ '^[A-Z]{3}$')`
    ),
    check(
      "document_extraction_invocations_error_shape",
      sql`(${table.status} = 'FAILED'
        and nullif(btrim(${table.errorCode}), '') is not null
        and nullif(btrim(${table.errorMessage}), '') is not null)
        or (${table.status} <> 'FAILED'
          and ${table.errorCode} is null and ${table.errorMessage} is null)`
    ),
    check(
      "document_extraction_invocations_timing_shape",
      sql`(${table.status} = 'RUNNING' and ${table.completedAt} is null)
        or (${table.status} in ('SUCCEEDED', 'FAILED') and ${table.completedAt} is not null)`
    )
  ]
);

export const documentPageClassifications = pgTable(
  "document_page_classifications",
  {
    runId: uuid("run_id").notNull(),
    documentId: uuid("document_id").notNull(),
    invocationId: uuid("invocation_id").notNull(),
    pageNumber: integer("page_number").notNull(),
    category: text("category").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    sectionTitle: text("section_title"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.pageNumber, table.category] }),
    foreignKey({
      columns: [table.runId, table.documentId],
      foreignColumns: [documentExtractionRuns.id, documentExtractionRuns.documentId],
      name: "document_page_classifications_run_document_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.invocationId, table.runId, table.documentId],
      foreignColumns: [
        documentExtractionInvocations.id,
        documentExtractionInvocations.runId,
        documentExtractionInvocations.documentId
      ],
      name: "document_page_classifications_invocation_scope_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.documentId, table.pageNumber],
      foreignColumns: [documentPages.documentId, documentPages.pageNumber],
      name: "document_page_classifications_document_page_fk"
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("document_page_classifications_category_idx").on(
      table.runId,
      table.category
    ),
    check(
      "document_page_classifications_confidence_range",
      sql`${table.confidence} between 0 and 1`
    ),
    check(
      "document_page_classifications_category_not_blank",
      sql`nullif(btrim(${table.category}), '') is not null`
    )
  ]
);
