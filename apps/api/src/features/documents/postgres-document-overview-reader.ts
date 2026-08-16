import {
  documentOverviewResponseSchema,
  type BridgeDataHealth,
  type DocumentOverviewItem,
  type DocumentOverviewResponse
} from "@bridge-os/contracts";
import {
  bridges,
  documentExtractionRuns,
  documentProcessingRuns,
  documents,
  inspections,
  partialStructures,
  plannedInterventions,
  recommendations,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import { desc, eq, sql } from "drizzle-orm";

import {
  deriveBridgeDataHealth,
  isAttentionIndicator,
  isLoadRecalculationDocument
} from "./data-health.js";
import type { DocumentOverviewReader } from "./document-overview-reader.js";

type Clock = () => Date;
type ProcessingRow = typeof documentProcessingRuns.$inferSelect;
type ExtractionRow = typeof documentExtractionRuns.$inferSelect;

interface DocumentRow {
  readonly id: string;
  readonly bridgeId: string | null;
  readonly type: string;
  readonly originalFilename: string;
  readonly status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  readonly metadata: Record<string, boolean | number | string | null> | null;
  readonly createdAt: Date;
  readonly bridgeExternalStructureNumber: string | null;
  readonly bridgeName: string | null;
  readonly bridgeRoad: string | null;
}

interface FindingQualityRow extends Record<string, unknown> {
  readonly bridgeId: string;
  readonly criticalWithoutEvidence: string | number;
  readonly requiringReview: string | number;
}

export class PostgresDocumentOverviewReader implements DocumentOverviewReader {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async listOverview(): Promise<DocumentOverviewResponse> {
    const asOf = this.clock();
    const [
      documentRows,
      processingRows,
      extractionRows,
      bridgeRows,
      partialRows,
      inspectionRows,
      trafficRows,
      recommendationRows,
      findingQualityResult
    ] = await Promise.all([
      this.loadDocuments(),
      this.database
        .select()
        .from(documentProcessingRuns)
        .orderBy(
          desc(documentProcessingRuns.createdAt),
          desc(documentProcessingRuns.id)
        ),
      this.database
        .select()
        .from(documentExtractionRuns)
        .orderBy(
          desc(documentExtractionRuns.attempt),
          desc(documentExtractionRuns.createdAt)
        ),
      this.database
        .select({
          id: bridges.id,
          externalStructureNumber: bridges.externalStructureNumber,
          name: bridges.name,
          road: bridges.road
        })
        .from(bridges)
        .orderBy(bridges.name, bridges.externalStructureNumber, bridges.id),
      this.database
        .select({
          bridgeId: partialStructures.bridgeId,
          lengthM: partialStructures.lengthM,
          widthM: partialStructures.widthM,
          areaSqM: partialStructures.areaSqM,
          spanCount: partialStructures.spanCount
        })
        .from(partialStructures),
      this.database
        .select({
          bridgeId: inspections.bridgeId,
          inspectedOn: inspections.inspectedOn,
          type: inspections.type
        })
        .from(inspections)
        .orderBy(desc(inspections.inspectedOn), desc(inspections.id)),
      this.database
        .select({
          bridgeId: trafficObservations.bridgeId,
          observationYear: trafficObservations.observationYear
        })
        .from(trafficObservations)
        .orderBy(
          desc(trafficObservations.observationYear),
          desc(trafficObservations.id)
        ),
      this.database
        .select({
          bridgeId: recommendations.bridgeId,
          status: recommendations.status,
          quantity: recommendations.quantity,
          unit: recommendations.unit,
          sourceEstimatedCost: recommendations.sourceEstimatedCost,
          planningEstimatedCost: plannedInterventions.estimatedCost
        })
        .from(recommendations)
        .leftJoin(
          plannedInterventions,
          eq(plannedInterventions.recommendationId, recommendations.id)
        ),
      this.loadFindingQuality()
    ]);

    const latestProcessing = latestByDocument(processingRows);
    const latestExtraction = latestByDocument(extractionRows);
    const overviewDocuments = documentRows.map((document) =>
      mapDocument(
        document,
        latestProcessing.get(document.id) ?? null,
        latestExtraction.get(document.id) ?? null
      )
    );
    const findingQuality = new Map(
      findingQualityResult.rows.map((row) => [
        row.bridgeId,
        {
          criticalWithoutEvidence: Number(row.criticalWithoutEvidence),
          requiringReview: Number(row.requiringReview)
        }
      ])
    );
    const bridgeDataHealth = bridgeRows.map((bridge): BridgeDataHealth => {
      const bridgeDocuments = documentRows.filter(
        (document) => document.bridgeId === bridge.id
      );
      const unresolvedExtractionErrors = bridgeDocuments.filter((document) => {
        const processing = latestProcessing.get(document.id);
        const extraction = latestExtraction.get(document.id);
        return processing?.status === "FAILED" || extraction?.status === "FAILED";
      }).length;
      const unresolvedRecommendations = recommendationRows.filter(
        (recommendation) =>
          recommendation.bridgeId === bridge.id &&
          recommendation.status !== "COMPLETED" &&
          recommendation.status !== "CANCELLED"
      );
      const quality = findingQuality.get(bridge.id) ?? {
        criticalWithoutEvidence: 0,
        requiringReview: 0
      };
      const indicators = deriveBridgeDataHealth({
        asOf,
        latestInspection:
          inspectionRows.find(
            (inspection) =>
              inspection.bridgeId === bridge.id && inspection.inspectedOn !== null
          ) ?? null,
        latestTrafficObservationYear:
          trafficRows.find((observation) => observation.bridgeId === bridge.id)
            ?.observationYear ?? null,
        partialStructures: partialRows.filter(
          (structure) => structure.bridgeId === bridge.id
        ),
        unresolvedExtractionErrors,
        recommendationsWithoutQuantity: unresolvedRecommendations.filter(
          (recommendation) =>
            recommendation.quantity === null || recommendation.unit === null
        ).length,
        recommendationsWithoutCostEstimate: unresolvedRecommendations.filter(
          (recommendation) =>
            recommendation.sourceEstimatedCost === null &&
            recommendation.planningEstimatedCost === null
        ).length,
        extractedFindingsRequiringReview: quality.requiringReview,
        criticalExtractedFindingsWithoutEvidence:
          quality.criticalWithoutEvidence,
        hasLoadRecalculationDocument: bridgeDocuments.some((document) =>
          isLoadRecalculationDocument(document.type, document.originalFilename)
        )
      });
      return {
        bridge,
        attentionCount: indicators.filter(isAttentionIndicator).length,
        indicators
      };
    });

    return documentOverviewResponseSchema.parse({
      asOf: asOf.toISOString(),
      summary: {
        totalDocuments: overviewDocuments.length,
        linkedDocuments: overviewDocuments.filter((document) => document.bridge !== null)
          .length,
        extractionSucceeded: overviewDocuments.filter(
          (document) => document.extraction.status === "SUCCEEDED"
        ).length,
        extractionPending: overviewDocuments.filter((document) =>
          [
            "PENDING",
            "CLASSIFYING",
            "EXTRACTING",
            "VALIDATING",
            "PERSISTING"
          ].includes(document.extraction.status)
        ).length,
        extractionFailed: overviewDocuments.filter(
          (document) => document.extraction.status === "FAILED"
        ).length,
        processingFailed: overviewDocuments.filter(
          (document) => document.processing?.status === "FAILED"
        ).length,
        bridgesWithAttention: bridgeDataHealth.filter(
          (health) => health.attentionCount > 0
        ).length,
        extractedFindingsRequiringReview: bridgeDataHealth.reduce(
          (total, health) =>
            total +
            (health.indicators.find(
              (indicator) => indicator.code === "EXTRACTED_FINDING_REVIEW"
            )?.count ?? 0),
          0
        )
      },
      documents: overviewDocuments,
      bridgeDataHealth
    });
  }

  private loadDocuments(): Promise<DocumentRow[]> {
    return this.database
      .select({
        id: documents.id,
        bridgeId: documents.bridgeId,
        type: documents.type,
        originalFilename: documents.originalFilename,
        status: documents.status,
        metadata: documents.metadata,
        createdAt: documents.createdAt,
        bridgeExternalStructureNumber: bridges.externalStructureNumber,
        bridgeName: bridges.name,
        bridgeRoad: bridges.road
      })
      .from(documents)
      .leftJoin(bridges, eq(bridges.id, documents.bridgeId))
      .orderBy(desc(documents.createdAt), desc(documents.id));
  }

  private loadFindingQuality() {
    return this.database.execute<FindingQualityRow>(sql`
      select
        b.id as "bridgeId",
        count(distinct f.id) filter (
          where f.status in ('OPEN', 'MONITORING')
            and exists (
              select 1
              from finding_evidence fe
              join source_evidence se on se.id = fe.evidence_id
              where fe.finding_id = f.id
                and se.extraction_run_id is not null
                and se.review_state = 'AUTOMATICALLY_EXTRACTED'
            )
        ) as "requiringReview",
        count(distinct f.id) filter (
          where b.data_origin = 'EXTRACTED'
            and f.status in ('OPEN', 'MONITORING')
            and greatest(
              coalesce(f.stability_rating, 0),
              coalesce(f.traffic_safety_rating, 0),
              coalesce(f.durability_rating, 0)
            ) >= 2
            and not exists (
              select 1
              from finding_evidence fe
              join source_evidence se on se.id = fe.evidence_id
              where fe.finding_id = f.id
                and fe.kind = 'SOURCE_FACT'
                and se.extraction_run_id is not null
                and se.page_number is not null
                and nullif(btrim(se.source_excerpt), '') is not null
            )
        ) as "criticalWithoutEvidence"
      from bridges b
      left join findings f on f.bridge_id = b.id
      group by b.id
    `);
  }
}

function latestByDocument<Row extends { readonly documentId: string }>(
  rows: readonly Row[]
): Map<string, Row> {
  const latest = new Map<string, Row>();
  for (const row of rows) {
    if (!latest.has(row.documentId)) latest.set(row.documentId, row);
  }
  return latest;
}

function mapDocument(
  document: DocumentRow,
  processing: ProcessingRow | null,
  extraction: ExtractionRow | null
): DocumentOverviewItem {
  return {
    id: document.id,
    originalFilename: document.originalFilename,
    type: document.type,
    status: document.status,
    uploadedAt: document.createdAt.toISOString(),
    isDemoFixture: document.metadata?.["fixture"] === true,
    bridge:
      document.bridgeId === null
        ? null
        : {
            id: document.bridgeId,
            externalStructureNumber: document.bridgeExternalStructureNumber,
            name: document.bridgeName,
            road: document.bridgeRoad
          },
    processing:
      processing === null
        ? null
        : {
            status: processing.status,
            parser: processing.parser,
            pageCount: processing.pageCount,
            error:
              processing.errorCode === null || processing.errorMessage === null
                ? null
                : {
                    stage: "PARSING",
                    code: processing.errorCode,
                    message: processing.errorMessage
                  }
          },
    extraction:
      extraction === null
        ? {
            status: "NOT_STARTED",
            attempt: null,
            pipelineVersion: null,
            provider: null,
            model: null,
            startedAt: null,
            completedAt: null,
            error: null
          }
        : {
            status: extraction.status,
            attempt: extraction.attempt,
            pipelineVersion: extraction.pipelineVersion,
            provider: extraction.provider,
            model: extraction.model,
            startedAt: extraction.startedAt?.toISOString() ?? null,
            completedAt: extraction.completedAt?.toISOString() ?? null,
            error:
              extraction.errorStage === null ||
              extraction.errorCode === null ||
              extraction.errorMessage === null
                ? null
                : {
                    stage: extraction.errorStage,
                    code: extraction.errorCode,
                    message: extraction.errorMessage
                  }
          }
  };
}
