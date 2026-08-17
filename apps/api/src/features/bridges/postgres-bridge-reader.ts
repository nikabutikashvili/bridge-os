import {
  bridgeDetailResponseSchema,
  bridgeDocumentsResponseSchema,
  bridgeFindingDetailResponseSchema,
  bridgeFindingsResponseSchema,
  bridgeHistoryResponseSchema,
  bridgeInspectionsResponseSchema,
  bridgePortfolioResponseSchema,
  bridgeRecommendationsResponseSchema,
  type BridgeDetailResponse,
  type BridgeDocumentsResponse,
  type BridgeFindingDetailResponse,
  type BridgeFindingsResponse,
  type BridgeHistoryResponse,
  type BridgeInspectionsResponse,
  type BridgeConditionTrend,
  type BridgePortfolioQuery,
  type BridgePortfolioResponse,
  type BridgeRecommendationsResponse,
  type EvidenceCitation,
  type InspectionDueStatus
} from "@bridge-os/contracts";
import {
  bridges,
  components,
  documents,
  environmentalMetrics,
  findings,
  historicalWorks,
  inspections,
  partialStructures,
  recommendationFindings,
  recommendations,
  sourceEvidence,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import { and, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";

import { adjustForConstructionPriceInflation } from "../budget/inflation-adjustment.js";
import { deriveBridgeAttention } from "./attention.js";
import { hasHighEnvironmentalExposure } from "./climate-exposure.js";
import {
  DAMAGE_MECHANISM_POLICY_VERSION,
  deriveDamageMechanisms
} from "./damage-mechanisms.js";
import type { BridgePhotoFile, BridgePortfolioReader } from "./bridge-reader.js";
import { bridgePhotoUrl } from "./bridge-photo.js";
import { buildDocumentSourceUrl } from "./source-url.js";

interface PortfolioRow extends Record<string, unknown> {
  id: string;
  externalStructureNumber: string | null;
  name: string | null;
  road: string | null;
  municipality: string | null;
  locality: string | null;
  dataOrigin: "EXTRACTED" | "USER_ENTERED" | "DEMO_FIXTURE" | null;
  constructionYear: number | null;
  structureType: string | null;
  partialStructureCount: number;
  conditionScore: string | null;
  previousConditionScore: string | null;
  conditionDelta: string | null;
  conditionTrend: BridgeConditionTrend;
  conditionAssessedOn: string | null;
  conditionInspectionType: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null;
  latestInspectionOn: string | null;
  nextDueOn: string | null;
  inspectionStatus: InspectionDueStatus;
  openFindings: number;
  openRecommendations: number;
  highestRecommendationUrgency: string | null;
  highestRecommendationUrgencyRank: number;
  nextRecommendationId: string | null;
  nextRecommendationDescription: string | null;
  nextRecommendationUrgency: string | null;
  nextRecommendationTargetYear: number | null;
  nextRecommendationPlannedYear: number | null;
  maximumStability: number | null;
  maximumTrafficSafety: number | null;
  maximumDurability: number | null;
  trafficObservationYear: number | null;
  trafficObservedOn: string | null;
  trafficDailyTraffic: number | null;
  trafficTruckSharePercent: string | null;
  trafficSource: "DOCUMENT" | "EXTERNAL_ENRICHED" | null;
  freezeThawDays: number | null;
  heavyRainDays20: number | null;
  deicingDays: number | null;
  hasPhoto: boolean;
}

interface PortfolioSummaryRow extends Record<string, unknown> {
  total: number;
  inspectionsDueOrOverdue: number;
  withOpenRecommendations: number;
  withNotableFindings: number;
}

interface EvidenceRow extends Record<string, unknown> {
  entityId: string;
  evidenceId: string;
  documentId: string;
  documentType: string;
  originalFilename: string;
  pageNumber: number | null;
  excerpt: string | null;
  boundingBoxX: string | null;
  boundingBoxY: string | null;
  boundingBoxWidth: string | null;
  boundingBoxHeight: string | null;
  extractionConfidence: string | null;
  extractionMethod: "MANUAL" | "TEXT_EXTRACTION" | "OCR" | "MODEL_EXTRACTION" | "IMPORT" | "OTHER";
  reviewState: "AUTOMATICALLY_EXTRACTED" | "HUMAN_CONFIRMED" | "HUMAN_REJECTED" | null;
  fieldName: string;
  kind: "SOURCE_FACT" | "DERIVED";
  derivationMethod: string | null;
  documentSourceUrl: string | null;
}

interface FindingRecommendationRow {
  findingId: string;
  recommendationId: string;
  workType: string | null;
  description: string | null;
  urgency: string | null;
  status: "OPEN" | "APPROVED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | null;
  targetYear: number | null;
  plannedYear: number | null;
}

interface RecommendationFindingRow {
  recommendationId: string;
  findingId: string;
  sourceIdentifier: string | null;
  defectType: string | null;
  description: string | null;
  status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
  inspectedOn: string | null;
}

type Clock = () => Date;

export class PostgresBridgePortfolioReader implements BridgePortfolioReader {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async listBridges(query: BridgePortfolioQuery): Promise<BridgePortfolioResponse> {
    const asOf = this.currentDate();
    const where = buildPortfolioWhere(query);
    const ctes = portfolioCtes(asOf);
    const offset = (query.page - 1) * query.pageSize;
    const orderBy = portfolioOrderBy(query);

    const [itemsResult, countResult] = await Promise.all([
      this.database.execute<PortfolioRow>(sql`
        ${ctes}
        select
          p.id,
          p.external_structure_number as "externalStructureNumber",
          p.name,
          p.road,
          p.municipality,
          p.locality,
          p.data_origin as "dataOrigin",
          p.construction_year as "constructionYear",
          p.structure_type as "structureType",
          p.partial_structure_count as "partialStructureCount",
          p.condition_score as "conditionScore",
          p.previous_condition_score as "previousConditionScore",
          p.condition_delta as "conditionDelta",
          p.condition_trend as "conditionTrend",
          p.condition_assessed_on as "conditionAssessedOn",
          p.condition_inspection_type as "conditionInspectionType",
          p.latest_inspection_on as "latestInspectionOn",
          p.next_due_on as "nextDueOn",
          p.inspection_status as "inspectionStatus",
          p.open_findings as "openFindings",
          p.open_recommendations as "openRecommendations",
          p.highest_recommendation_urgency as "highestRecommendationUrgency",
          p.highest_recommendation_urgency_rank as "highestRecommendationUrgencyRank",
          p.next_recommendation_id as "nextRecommendationId",
          p.next_recommendation_description as "nextRecommendationDescription",
          p.next_recommendation_urgency as "nextRecommendationUrgency",
          p.next_recommendation_target_year as "nextRecommendationTargetYear",
          p.next_recommendation_planned_year as "nextRecommendationPlannedYear",
          p.maximum_stability as "maximumStability",
          p.maximum_traffic_safety as "maximumTrafficSafety",
          p.maximum_durability as "maximumDurability",
          p.traffic_observation_year as "trafficObservationYear",
          p.traffic_observed_on as "trafficObservedOn",
          p.traffic_daily_traffic as "trafficDailyTraffic",
          p.traffic_truck_share_percent as "trafficTruckSharePercent",
          p.traffic_source as "trafficSource",
          p.freeze_thaw_days as "freezeThawDays",
          p.heavy_rain_days_20 as "heavyRainDays20",
          p.deicing_days as "deicingDays",
          exists (
            select 1
            from documents d
            where d.bridge_id = p.id
              and d.photo_storage_key is not null
          ) as "hasPhoto"
        from portfolio p
        ${where}
        order by ${orderBy}, p.id asc
        limit ${query.pageSize}
        offset ${offset}
      `),
      this.database.execute<PortfolioSummaryRow>(sql`
        ${ctes}
        select
          count(*)::int as total,
          count(*) filter (
            where p.inspection_status in ('OVERDUE', 'DUE_SOON')
          )::int as "inspectionsDueOrOverdue",
          count(*) filter (
            where p.open_recommendations > 0
          )::int as "withOpenRecommendations",
          count(*) filter (
            where greatest(
              coalesce(p.maximum_stability, 0),
              coalesce(p.maximum_traffic_safety, 0),
              coalesce(p.maximum_durability, 0)
            ) >= 2
          )::int as "withNotableFindings"
        from portfolio p
        ${where}
      `)
    ]);

    const summary = countResult.rows[0] ?? {
      total: 0,
      inspectionsDueOrOverdue: 0,
      withOpenRecommendations: 0,
      withNotableFindings: 0
    };
    const totalItems = summary.total;

    return bridgePortfolioResponseSchema.parse({
      data: itemsResult.rows.map(mapPortfolioRow),
      summary: {
        structures: summary.total,
        inspectionsDueOrOverdue: summary.inspectionsDueOrOverdue,
        withOpenRecommendations: summary.withOpenRecommendations,
        withNotableFindings: summary.withNotableFindings
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize)
      },
      sort: { field: query.sort, direction: query.direction },
      asOf
    });
  }

  public async getBridge(id: string): Promise<BridgeDetailResponse | null> {
    const asOf = this.currentDate();
    const [
      bridgeRows,
      partialStructureRows,
      componentRows,
      trafficRows,
      environmentRows,
      mechanismFindingRows,
      portfolioItem,
      evidenceRows
    ] = await Promise.all([
      this.database
        .select({
          id: bridges.id,
          externalStructureNumber: bridges.externalStructureNumber,
          name: bridges.name,
          road: bridges.road,
          dataOrigin: bridges.dataOrigin,
          countryCode: bridges.countryCode,
          federalState: bridges.federalState,
          district: bridges.district,
          municipality: bridges.municipality,
          locality: bridges.locality,
          crossedFeature: bridges.crossedFeature,
          latitude: bridges.latitude,
          longitude: bridges.longitude,
          owner: bridges.owner,
          loadBearingResponsibility: bridges.loadBearingResponsibility,
          responsibleAuthority: bridges.responsibleAuthority,
          maintenanceOffice: bridges.maintenanceOffice
        })
        .from(bridges)
        .where(eq(bridges.id, id))
        .limit(1),
      this.database
        .select({
          id: partialStructures.id,
          externalNumber: partialStructures.externalPartialStructureNumber,
          name: partialStructures.name,
          constructionYear: partialStructures.constructionYear,
          structureType: partialStructures.structureType,
          structuralSystem: partialStructures.structuralSystem,
          lengthM: partialStructures.lengthM,
          widthM: partialStructures.widthM,
          areaSqM: partialStructures.areaSqM,
          clearHeightM: partialStructures.clearHeightM,
          spanCount: partialStructures.spanCount
        })
        .from(partialStructures)
        .where(eq(partialStructures.bridgeId, id))
        .orderBy(partialStructures.externalPartialStructureNumber, partialStructures.id),
      this.database
        .select({
          id: components.id,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber:
            partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          type: components.type,
          name: components.name,
          location: components.location,
          material: components.material,
          constructionYear: components.constructionYear,
          installYear: components.installYear
        })
        .from(components)
        .innerJoin(
          partialStructures,
          eq(partialStructures.id, components.partialStructureId)
        )
        .where(eq(components.bridgeId, id))
        .orderBy(components.type, components.name, components.id),
      this.database
        .select({
          id: trafficObservations.id,
          observationYear: trafficObservations.observationYear,
          observedOn: trafficObservations.observedOn,
          dailyTraffic: trafficObservations.dailyTraffic,
          truckSharePercent: trafficObservations.truckSharePercent,
          source: trafficObservations.source,
          sourceDescription: trafficObservations.sourceDescription
        })
        .from(trafficObservations)
        .where(eq(trafficObservations.bridgeId, id))
        .orderBy(sql`${trafficObservations.observationYear} desc`, sql`${trafficObservations.observedOn} desc nulls last`)
        .limit(1),
      this.database
        .select()
        .from(environmentalMetrics)
        .where(eq(environmentalMetrics.bridgeId, id))
        .orderBy(desc(environmentalMetrics.observationYear)),
      this.database
        .select({
          id: findings.id,
          defectType: findings.defectType,
          description: findings.description,
          sourceIdentifier: findings.sourceIdentifier,
          durabilityRating: findings.durabilityRating,
          status: findings.status,
          componentType: components.type,
          componentMaterial: components.material
        })
        .from(findings)
        .leftJoin(components, eq(components.id, findings.componentId))
        .where(eq(findings.bridgeId, id)),
      this.getPortfolioItem(id, asOf),
      this.loadBridgeOverviewEvidence(id)
    ]);

    const bridge = bridgeRows[0];
    if (!bridge || !portfolioItem) {
      return null;
    }

    const evidenceByEntity = groupEvidence(evidenceRows);
    const latestTraffic = trafficRows[0];
    const asOfYear = Number(asOf.slice(0, 4));

    return bridgeDetailResponseSchema.parse({
      data: {
        id: bridge.id,
        externalStructureNumber: bridge.externalStructureNumber,
        name: bridge.name,
        road: bridge.road,
        dataOrigin: bridge.dataOrigin,
        location: {
          countryCode: bridge.countryCode,
          federalState: bridge.federalState,
          district: bridge.district,
          municipality: bridge.municipality,
          locality: bridge.locality,
          crossedFeature: bridge.crossedFeature,
          latitude: bridge.latitude,
          longitude: bridge.longitude
        },
        responsibility: {
          owner: bridge.owner,
          loadBearingResponsibility: bridge.loadBearingResponsibility,
          responsibleAuthority: bridge.responsibleAuthority,
          maintenanceOffice: bridge.maintenanceOffice
        },
        partialStructures: partialStructureRows.map((partialStructure) => ({
          id: partialStructure.id,
          externalNumber: partialStructure.externalNumber,
          name: partialStructure.name,
          constructionYear: partialStructure.constructionYear,
          evidence: evidenceByEntity.get(partialStructure.id) ?? [],
          structureType: partialStructure.structureType,
          structuralSystem: partialStructure.structuralSystem,
          geometry: {
            lengthM: partialStructure.lengthM,
            widthM: partialStructure.widthM,
            areaSqM: partialStructure.areaSqM,
            clearHeightM: partialStructure.clearHeightM,
            spanCount: partialStructure.spanCount
          }
        })),
        condition: portfolioItem.condition,
        inspection: portfolioItem.inspection,
        attention: portfolioItem.attention,
        technicalData: {
          components: componentRows.map((component) => ({
            id: component.id,
            partialStructure: {
              id: component.partialStructureId,
              externalNumber: component.partialStructureExternalNumber,
              name: component.partialStructureName
            },
            type: component.type,
            name: component.name,
            location: component.location,
            material: component.material,
            constructionYear: component.constructionYear,
            installYear: component.installYear
          }))
        },
        evidence: evidenceByEntity.get(bridge.id) ?? [],
        photoUrl: portfolioItem.photoUrl,
        latestTraffic:
          latestTraffic === undefined
            ? null
            : {
                observationYear: latestTraffic.observationYear,
                observedOn: latestTraffic.observedOn,
                dailyTraffic: latestTraffic.dailyTraffic,
                truckSharePercent: latestTraffic.truckSharePercent,
                source: latestTraffic.source,
                sourceDescription: latestTraffic.sourceDescription,
                evidence: evidenceByEntity.get(latestTraffic.id) ?? []
              },
        environment: mapBridgeEnvironment({
          asOfYear,
          constructionYear: partialStructureRows[0]?.constructionYear ?? null,
          crossedFeature: bridge.crossedFeature,
          dailyTraffic: latestTraffic?.dailyTraffic ?? null,
          components: componentRows,
          findings: mechanismFindingRows,
          rows: environmentRows
        })
      },
      asOf
    });
  }

  public async getBridgePhoto(id: string): Promise<BridgePhotoFile | null> {
    const [row] = await this.database
      .select({
        mimeType: documents.photoMimeType,
        storageKey: documents.photoStorageKey
      })
      .from(documents)
      .where(and(eq(documents.bridgeId, id), isNotNull(documents.photoStorageKey)))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(1);
    if (row?.storageKey == null || row.mimeType !== "image/jpeg") {
      return null;
    }
    return { mimeType: "image/jpeg", storageKey: row.storageKey };
  }

  public async getInspections(id: string): Promise<BridgeInspectionsResponse | null> {
    const [exists, rows, evidenceRows] = await Promise.all([
      this.bridgeExists(id),
      this.database
        .select({
          id: inspections.id,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber: partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          type: inspections.type,
          inspectedOn: inspections.inspectedOn,
          inspector: inspections.inspector,
          conditionScore: inspections.conditionScore,
          cycleMonths: inspections.cycleMonths,
          nextDueOn: sql<string | null>`case
            when ${inspections.inspectedOn} is null or ${inspections.cycleMonths} is null then null
            else (${inspections.inspectedOn} + make_interval(months => ${inspections.cycleMonths}))::date
          end`
        })
        .from(inspections)
        .innerJoin(partialStructures, eq(partialStructures.id, inspections.partialStructureId))
        .where(eq(inspections.bridgeId, id))
        .orderBy(sql`${inspections.inspectedOn} desc nulls last`, inspections.id),
      this.loadInspectionEvidence(id)
    ]);

    if (!exists) {
      return null;
    }

    const evidenceByInspection = groupEvidence(evidenceRows);

    return bridgeInspectionsResponseSchema.parse({
      data: rows.map((row) => ({
        id: row.id,
        partialStructure: {
          id: row.partialStructureId,
          externalNumber: row.partialStructureExternalNumber,
          name: row.partialStructureName
        },
        type: row.type,
        inspectedOn: row.inspectedOn,
        inspector: row.inspector,
        conditionScore: row.conditionScore,
        cycleMonths: row.cycleMonths,
        nextDueOn: row.nextDueOn,
        evidence: evidenceByInspection.get(row.id) ?? []
      }))
    });
  }

  public async getFindings(id: string): Promise<BridgeFindingsResponse | null> {
    const [exists, rows, recommendationRows, evidenceRows] = await Promise.all([
      this.bridgeExists(id),
      this.database
        .select({
          id: findings.id,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber: partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          inspectionId: inspections.id,
          inspectionType: inspections.type,
          inspectedOn: inspections.inspectedOn,
          componentId: components.id,
          componentType: components.type,
          componentName: components.name,
          sourceIdentifier: findings.sourceIdentifier,
          defectType: findings.defectType,
          description: findings.description,
          location: findings.location,
          extent: findings.extent,
          dimensionLength: findings.dimensionLength,
          dimensionWidth: findings.dimensionWidth,
          dimensionDepth: findings.dimensionDepth,
          dimensionUnit: findings.dimensionUnit,
          quantity: findings.quantity,
          quantityUnit: findings.quantityUnit,
          stabilityRating: findings.stabilityRating,
          trafficSafetyRating: findings.trafficSafetyRating,
          durabilityRating: findings.durabilityRating,
          status: findings.status
        })
        .from(findings)
        .innerJoin(partialStructures, eq(partialStructures.id, findings.partialStructureId))
        .innerJoin(inspections, eq(inspections.id, findings.inspectionId))
        .leftJoin(components, eq(components.id, findings.componentId))
        .where(eq(findings.bridgeId, id))
        .orderBy(sql`${inspections.inspectedOn} desc nulls last`, findings.sourceIdentifier, findings.id),
      this.database
        .select({
          findingId: recommendationFindings.findingId,
          recommendationId: recommendations.id,
          workType: recommendations.workType,
          description: recommendations.description,
          urgency: recommendations.urgency,
          status: recommendations.status,
          targetYear: recommendations.targetYear,
          plannedYear: recommendations.plannedYear
        })
        .from(recommendationFindings)
        .innerJoin(
          recommendations,
          eq(recommendations.id, recommendationFindings.recommendationId)
        )
        .where(eq(recommendationFindings.bridgeId, id))
        .orderBy(recommendations.plannedYear, recommendations.targetYear, recommendations.id),
      this.loadFindingEvidence(id)
    ]);

    if (!exists) {
      return null;
    }

    const evidenceByFinding = groupEvidence(evidenceRows);
    const recommendationsByFinding = groupFindingRecommendations(recommendationRows);

    return bridgeFindingsResponseSchema.parse({
      data: rows.map((row) => ({
        id: row.id,
        partialStructure: {
          id: row.partialStructureId,
          externalNumber: row.partialStructureExternalNumber,
          name: row.partialStructureName
        },
        inspection: {
          id: row.inspectionId,
          type: row.inspectionType,
          inspectedOn: row.inspectedOn
        },
        component:
          row.componentId === null
            ? null
            : { id: row.componentId, type: row.componentType, name: row.componentName },
        sourceIdentifier: row.sourceIdentifier,
        defectType: row.defectType,
        description: row.description,
        location: row.location,
        extent: row.extent,
        dimensions:
          row.dimensionUnit === null
            ? null
            : {
                length: row.dimensionLength,
                width: row.dimensionWidth,
                depth: row.dimensionDepth,
                unit: row.dimensionUnit
              },
        quantity:
          row.quantity === null || row.quantityUnit === null
            ? null
            : { value: row.quantity, unit: row.quantityUnit },
        ratings: {
          stability: row.stabilityRating,
          trafficSafety: row.trafficSafetyRating,
          durability: row.durabilityRating
        },
        status: row.status,
        linkedRecommendations: recommendationsByFinding.get(row.id) ?? [],
        evidence: evidenceByFinding.get(row.id) ?? []
      }))
    });
  }

  public async getFinding(
    bridgeId: string,
    findingId: string
  ): Promise<BridgeFindingDetailResponse | null> {
    const findingsResponse = await this.getFindings(bridgeId);
    const finding = findingsResponse?.data.find((item) => item.id === findingId);
    return finding === undefined
      ? null
      : bridgeFindingDetailResponseSchema.parse({ data: finding });
  }

  public async getRecommendations(id: string): Promise<BridgeRecommendationsResponse | null> {
    const [exists, rows, findingLinks, evidenceRows] = await Promise.all([
      this.bridgeExists(id),
      this.database
        .select({
          id: recommendations.id,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber: partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          workType: recommendations.workType,
          description: recommendations.description,
          urgency: recommendations.urgency,
          quantity: recommendations.quantity,
          unit: recommendations.unit,
          sourceEstimatedCost: recommendations.sourceEstimatedCost,
          sourceEstimatedCostCurrency: recommendations.sourceEstimatedCostCurrency,
          targetYear: recommendations.targetYear,
          plannedYear: recommendations.plannedYear,
          status: recommendations.status
        })
        .from(recommendations)
        .innerJoin(partialStructures, eq(partialStructures.id, recommendations.partialStructureId))
        .where(eq(recommendations.bridgeId, id))
        .orderBy(recommendations.plannedYear, recommendations.targetYear, recommendations.id),
      this.database
        .select({
          recommendationId: recommendationFindings.recommendationId,
          findingId: recommendationFindings.findingId,
          sourceIdentifier: findings.sourceIdentifier,
          defectType: findings.defectType,
          description: findings.description,
          status: findings.status,
          inspectedOn: inspections.inspectedOn
        })
        .from(recommendationFindings)
        .innerJoin(findings, eq(findings.id, recommendationFindings.findingId))
        .innerJoin(inspections, eq(inspections.id, findings.inspectionId))
        .where(eq(recommendationFindings.bridgeId, id)),
      this.loadRecommendationEvidence(id)
    ]);

    if (!exists) {
      return null;
    }

    const findingsByRecommendation = groupRecommendationFindings(findingLinks);
    const evidenceByRecommendation = groupEvidence(evidenceRows);
    const sourceDateByRecommendation = groupEarliestInspectionDate(findingLinks);
    const asOfYear = this.clock().getUTCFullYear();

    return bridgeRecommendationsResponseSchema.parse({
      data: rows.map((row) => {
        const sourceEstimatedCost =
          row.sourceEstimatedCost === null || row.sourceEstimatedCostCurrency === null
            ? null
            : {
                amount: row.sourceEstimatedCost,
                currency: row.sourceEstimatedCostCurrency
              };
        const sourceDate = sourceDateByRecommendation.get(row.id) ?? null;
        const inflationAdjustedEstimate =
          sourceEstimatedCost === null || sourceDate === null
            ? null
            : adjustForConstructionPriceInflation({
                amount: sourceEstimatedCost.amount,
                currency: sourceEstimatedCost.currency,
                sourceYear: Number(sourceDate.slice(0, 4)),
                asOfYear
              });

        return {
          id: row.id,
          partialStructure: {
            id: row.partialStructureId,
            externalNumber: row.partialStructureExternalNumber,
            name: row.partialStructureName
          },
          workType: row.workType,
          description: row.description,
          urgency: row.urgency,
          quantity:
            row.quantity === null || row.unit === null
              ? null
              : { value: row.quantity, unit: row.unit },
          sourceEstimatedCost,
          sourceDate,
          inflationAdjustedEstimate,
          targetYear: row.targetYear,
          plannedYear: row.plannedYear,
          status: row.status,
          linkedFindings: findingsByRecommendation.get(row.id) ?? [],
          evidence: evidenceByRecommendation.get(row.id) ?? []
        };
      })
    });
  }

  public async getHistory(id: string): Promise<BridgeHistoryResponse | null> {
    const [exists, inspectionRows, workRows, trafficRows, evidenceRows] = await Promise.all([
      this.bridgeExists(id),
      this.database
        .select({
          id: inspections.id,
          date: inspections.inspectedOn,
          type: inspections.type,
          conditionScore: inspections.conditionScore,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber: partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name
        })
        .from(inspections)
        .innerJoin(partialStructures, eq(partialStructures.id, inspections.partialStructureId))
        .where(eq(inspections.bridgeId, id)),
      this.database
        .select({
          id: historicalWorks.id,
          date: historicalWorks.startedOn,
          endDate: historicalWorks.endedOn,
          title: historicalWorks.title,
          workType: historicalWorks.type,
          reason: historicalWorks.reason,
          quantity: historicalWorks.quantity,
          unit: historicalWorks.unit,
          contractAmount: historicalWorks.contractAmount,
          finalAmount: historicalWorks.finalAmount,
          currency: historicalWorks.currency
        })
        .from(historicalWorks)
        .where(eq(historicalWorks.bridgeId, id)),
      this.database
        .select({
          id: trafficObservations.id,
          date: trafficObservations.observedOn,
          observationYear: trafficObservations.observationYear,
          dailyTraffic: trafficObservations.dailyTraffic,
          truckSharePercent: trafficObservations.truckSharePercent,
          source: trafficObservations.source,
          sourceDescription: trafficObservations.sourceDescription
        })
        .from(trafficObservations)
        .where(eq(trafficObservations.bridgeId, id)),
      this.loadHistoryEvidence(id)
    ]);

    if (!exists) {
      return null;
    }

    const evidenceByEvent = groupEvidence(evidenceRows);
    const events: BridgeHistoryResponse["data"] = [
      ...inspectionRows.map((row) => ({
        kind: "INSPECTION" as const,
        id: row.id,
        date: row.date,
        title: inspectionTitle(row.type),
        evidence: evidenceByEvent.get(row.id) ?? [],
        partialStructure: {
          id: row.partialStructureId,
          externalNumber: row.partialStructureExternalNumber,
          name: row.partialStructureName
        },
        inspectionType: row.type,
        conditionScore: row.conditionScore
      })),
      ...workRows.map((row) => ({
        kind: "HISTORICAL_WORK" as const,
        id: row.id,
        date: row.date,
        title: row.title ?? "Historical work",
        evidence: evidenceByEvent.get(row.id) ?? [],
        endDate: row.endDate,
        workType: row.workType,
        reason: row.reason,
        quantity:
          row.quantity === null || row.unit === null
            ? null
            : { value: row.quantity, unit: row.unit },
        contractAmount:
          row.contractAmount === null || row.currency === null
            ? null
            : { amount: row.contractAmount, currency: row.currency },
        finalAmount:
          row.finalAmount === null || row.currency === null
            ? null
            : { amount: row.finalAmount, currency: row.currency }
      })),
      ...trafficRows.map((row) => ({
        kind: "TRAFFIC_OBSERVATION" as const,
        id: row.id,
        date: row.date,
        title: `Traffic observation ${String(row.observationYear)}`,
        evidence: evidenceByEvent.get(row.id) ?? [],
        observationYear: row.observationYear,
        dailyTraffic: row.dailyTraffic,
        truckSharePercent: row.truckSharePercent,
        source: row.source,
        sourceDescription: row.sourceDescription
      }))
    ];

    events.sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
    return bridgeHistoryResponseSchema.parse({ data: events });
  }

  public async getDocuments(id: string): Promise<BridgeDocumentsResponse | null> {
    const [exists, rows] = await Promise.all([
      this.bridgeExists(id),
      this.database
        .select({
          id: documents.id,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber: partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          type: documents.type,
          originalFilename: documents.originalFilename,
          status: documents.status,
          metadata: documents.metadata,
          evidenceCount: sql<number>`(
            select count(*)::int from ${sourceEvidence}
            where ${sourceEvidence.documentId} = ${documents.id}
          )`,
          evidencePages: sql<number[]>`coalesce((
            select array_agg(distinct ${sourceEvidence.pageNumber} order by ${sourceEvidence.pageNumber})
            from ${sourceEvidence}
            where ${sourceEvidence.documentId} = ${documents.id}
              and ${sourceEvidence.pageNumber} is not null
          ), '{}'::integer[])`
        })
        .from(documents)
        .leftJoin(partialStructures, eq(partialStructures.id, documents.partialStructureId))
        .where(eq(documents.bridgeId, id))
        .orderBy(documents.type, documents.originalFilename)
    ]);

    if (!exists) {
      return null;
    }

    return bridgeDocumentsResponseSchema.parse({
      data: rows.map((row) => ({
        id: row.id,
        partialStructure:
          row.partialStructureId === null
            ? null
            : {
                id: row.partialStructureId,
                externalNumber: row.partialStructureExternalNumber,
                name: row.partialStructureName
              },
        type: row.type,
        originalFilename: row.originalFilename,
        status: row.status,
        isDemoFixture: row.metadata?.["fixture"] === true,
        evidenceCount: row.evidenceCount,
        evidencePages: row.evidencePages
      }))
    });
  }

  private currentDate(): string {
    return this.clock().toISOString().slice(0, 10);
  }

  private async bridgeExists(id: string): Promise<boolean> {
    const rows = await this.database
      .select({ id: bridges.id })
      .from(bridges)
      .where(eq(bridges.id, id))
      .limit(1);
    return rows.length === 1;
  }

  private async getPortfolioItem(
    id: string,
    asOf: string
  ): Promise<ReturnType<typeof mapPortfolioRow> | null> {
    const ctes = portfolioCtes(asOf);
    const result = await this.database.execute<PortfolioRow>(sql`
      ${ctes}
      select
        p.id,
        p.external_structure_number as "externalStructureNumber",
        p.name,
        p.road,
        p.municipality,
        p.locality,
        p.data_origin as "dataOrigin",
        p.construction_year as "constructionYear",
        p.structure_type as "structureType",
        p.partial_structure_count as "partialStructureCount",
        p.condition_score as "conditionScore",
        p.previous_condition_score as "previousConditionScore",
        p.condition_delta as "conditionDelta",
        p.condition_trend as "conditionTrend",
        p.condition_assessed_on as "conditionAssessedOn",
        p.condition_inspection_type as "conditionInspectionType",
        p.latest_inspection_on as "latestInspectionOn",
        p.next_due_on as "nextDueOn",
        p.inspection_status as "inspectionStatus",
        p.open_findings as "openFindings",
        p.open_recommendations as "openRecommendations",
        p.highest_recommendation_urgency as "highestRecommendationUrgency",
        p.highest_recommendation_urgency_rank as "highestRecommendationUrgencyRank",
        p.next_recommendation_id as "nextRecommendationId",
        p.next_recommendation_description as "nextRecommendationDescription",
        p.next_recommendation_urgency as "nextRecommendationUrgency",
        p.next_recommendation_target_year as "nextRecommendationTargetYear",
        p.next_recommendation_planned_year as "nextRecommendationPlannedYear",
        p.maximum_stability as "maximumStability",
        p.maximum_traffic_safety as "maximumTrafficSafety",
        p.maximum_durability as "maximumDurability",
        p.traffic_observation_year as "trafficObservationYear",
        p.traffic_observed_on as "trafficObservedOn",
        p.traffic_daily_traffic as "trafficDailyTraffic",
        p.traffic_truck_share_percent as "trafficTruckSharePercent",
        p.traffic_source as "trafficSource",
        p.freeze_thaw_days as "freezeThawDays",
        p.heavy_rain_days_20 as "heavyRainDays20",
        p.deicing_days as "deicingDays",
        exists (
          select 1
          from documents d
          where d.bridge_id = p.id
            and d.photo_storage_key is not null
        ) as "hasPhoto"
      from portfolio p
      where p.id = ${id}
      limit 1
    `);
    const row = result.rows[0];
    return row ? mapPortfolioRow(row) : null;
  }

  private async loadFindingEvidence(bridgeId: string): Promise<EvidenceRow[]> {
    return this.loadEvidence(
      sql`
        select
          fe.finding_id as "entityId",
          ${evidenceSelectColumns("fe")}
        from finding_evidence fe
        join findings f on f.id = fe.finding_id
        join source_evidence se on se.id = fe.evidence_id
        join documents d on d.id = se.document_id
        where f.bridge_id = ${bridgeId}
        order by fe.finding_id, se.page_number nulls last, fe.field_name
      `
    );
  }

  private async loadBridgeOverviewEvidence(bridgeId: string): Promise<EvidenceRow[]> {
    return this.loadEvidence(sql`
      select be.bridge_id as "entityId", ${evidenceSelectColumns("be")}
      from bridge_evidence be
      join source_evidence se on se.id = be.evidence_id
      join documents d on d.id = se.document_id
      where be.bridge_id = ${bridgeId}

      union all

      select pse.partial_structure_id as "entityId", ${evidenceSelectColumns("pse")}
      from partial_structure_evidence pse
      join partial_structures ps on ps.id = pse.partial_structure_id
      join source_evidence se on se.id = pse.evidence_id
      join documents d on d.id = se.document_id
      where ps.bridge_id = ${bridgeId}

      union all

      select toe.traffic_observation_id as "entityId", ${evidenceSelectColumns("toe")}
      from traffic_observation_evidence toe
      join traffic_observations t on t.id = toe.traffic_observation_id
      join source_evidence se on se.id = toe.evidence_id
      join documents d on d.id = se.document_id
      where t.bridge_id = ${bridgeId}

      order by "entityId", "pageNumber" nulls last, "fieldName"
    `);
  }

  private async loadInspectionEvidence(bridgeId: string): Promise<EvidenceRow[]> {
    return this.loadEvidence(sql`
      select ie.inspection_id as "entityId", ${evidenceSelectColumns("ie")}
      from inspection_evidence ie
      join inspections i on i.id = ie.inspection_id
      join source_evidence se on se.id = ie.evidence_id
      join documents d on d.id = se.document_id
      where i.bridge_id = ${bridgeId}
      order by ie.inspection_id, se.page_number nulls last, ie.field_name
    `);
  }

  private async loadHistoryEvidence(bridgeId: string): Promise<EvidenceRow[]> {
    return this.loadEvidence(sql`
      select ie.inspection_id as "entityId", ${evidenceSelectColumns("ie")}
      from inspection_evidence ie
      join inspections i on i.id = ie.inspection_id
      join source_evidence se on se.id = ie.evidence_id
      join documents d on d.id = se.document_id
      where i.bridge_id = ${bridgeId}

      union all

      select hwe.historical_work_id as "entityId", ${evidenceSelectColumns("hwe")}
      from historical_work_evidence hwe
      join historical_works hw on hw.id = hwe.historical_work_id
      join source_evidence se on se.id = hwe.evidence_id
      join documents d on d.id = se.document_id
      where hw.bridge_id = ${bridgeId}

      union all

      select toe.traffic_observation_id as "entityId", ${evidenceSelectColumns("toe")}
      from traffic_observation_evidence toe
      join traffic_observations t on t.id = toe.traffic_observation_id
      join source_evidence se on se.id = toe.evidence_id
      join documents d on d.id = se.document_id
      where t.bridge_id = ${bridgeId}

      order by "entityId", "pageNumber" nulls last, "fieldName"
    `);
  }

  private async loadRecommendationEvidence(bridgeId: string): Promise<EvidenceRow[]> {
    return this.loadEvidence(
      sql`
        select
          re.recommendation_id as "entityId",
          ${evidenceSelectColumns("re")}
        from recommendation_evidence re
        join recommendations r on r.id = re.recommendation_id
        join source_evidence se on se.id = re.evidence_id
        join documents d on d.id = se.document_id
        where r.bridge_id = ${bridgeId}
        order by re.recommendation_id, se.page_number nulls last, re.field_name
      `
    );
  }

  private async loadEvidence(query: SQL): Promise<EvidenceRow[]> {
    const result = await this.database.execute<EvidenceRow>(query);
    return result.rows;
  }
}

function portfolioCtes(asOf: string): SQL {
  return sql`
    with ranked_inspections as (
      select
        i.*,
        row_number() over (
          partition by i.partial_structure_id
          order by i.inspected_on desc nulls last, i.created_at desc, i.id
        ) as row_number
      from inspections i
    ),
    current_inspections as (
      select * from ranked_inspections where row_number = 1
    ),
    previous_inspections as (
      select * from ranked_inspections where row_number = 2
    ),
    structure_summary as (
      select
        ps.bridge_id,
        count(*)::int as partial_structure_count,
        min(ps.construction_year)::int as construction_year,
        case
          when count(distinct ps.structure_type) filter (where ps.structure_type is not null) > 1
            then 'Multiple'
          else min(ps.structure_type)
        end as structure_type
      from partial_structures ps
      group by ps.bridge_id
    ),
    inspection_summary as (
      select
        ci.bridge_id,
        max(ci.inspected_on)::text as latest_inspection_on,
        (min((ci.inspected_on + make_interval(months => ci.cycle_months))::date)
          filter (where ci.inspected_on is not null and ci.cycle_months is not null))::text
          as next_due_on,
        count(*)::int as current_inspection_count,
        count(*) filter (
          where ci.inspected_on is not null and ci.cycle_months is not null
        )::int as computable_inspection_count
      from current_inspections ci
      group by ci.bridge_id
    ),
    headline_inspection as (
      select distinct on (ci.bridge_id)
        ci.bridge_id,
        ci.condition_score,
        pi.condition_score as previous_condition_score,
        (ci.condition_score - pi.condition_score)::numeric(2, 1) as condition_delta,
        case
          when ci.condition_score is null or pi.condition_score is null then 'UNKNOWN'
          when ci.condition_score > pi.condition_score then 'DETERIORATING'
          when ci.condition_score < pi.condition_score then 'IMPROVING'
          else 'STABLE'
        end as condition_trend,
        ci.inspected_on::text as condition_assessed_on,
        ci.type as condition_inspection_type
      from current_inspections ci
      left join previous_inspections pi on pi.partial_structure_id = ci.partial_structure_id
      order by ci.bridge_id, ci.condition_score desc nulls last, ci.inspected_on desc nulls last
    ),
    finding_summary as (
      select
        f.bridge_id,
        count(*) filter (where f.status in ('OPEN', 'MONITORING'))::int as open_findings,
        max(f.stability_rating) filter (where f.status in ('OPEN', 'MONITORING'))::int as maximum_stability,
        max(f.traffic_safety_rating) filter (where f.status in ('OPEN', 'MONITORING'))::int as maximum_traffic_safety,
        max(f.durability_rating) filter (where f.status in ('OPEN', 'MONITORING'))::int as maximum_durability
      from findings f
      group by f.bridge_id
    ),
    latest_traffic as (
      select distinct on (t.bridge_id)
        t.bridge_id,
        t.observation_year,
        t.observed_on::text as observed_on,
        t.daily_traffic,
        t.truck_share_percent,
        t.source
      from traffic_observations t
      order by t.bridge_id, t.observation_year desc, t.observed_on desc nulls last
    ),
    latest_environment as (
      select distinct on (e.bridge_id)
        e.bridge_id,
        e.freeze_thaw_days,
        e.heavy_rain_days_20,
        e.deicing_days
      from environmental_metrics e
      order by e.bridge_id, e.observation_year desc
    ),
    active_recommendations as (
      select
        r.*,
        case
          when upper(r.urgency) in (
            'SOFORT', 'UNVERZUEGLICH', 'UNVERZÜGLICH', 'DRINGEND', 'IMMEDIATE'
          ) then 4
          when upper(r.urgency) in ('KURZFRISTIG', 'SHORT_TERM') then 3
          when upper(r.urgency) in ('MITTELFRISTIG', 'MEDIUM_TERM') then 2
          when upper(r.urgency) in ('LANGFRISTIG', 'LONG_TERM') then 1
          else 0
        end as urgency_rank
      from recommendations r
      where r.status in ('OPEN', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS')
    ),
    recommendation_summary as (
      select ar.bridge_id, count(*)::int as open_recommendations
      from active_recommendations ar
      group by ar.bridge_id
    ),
    headline_recommendation as (
      select distinct on (ar.bridge_id)
        ar.bridge_id,
        ar.id,
        ar.description,
        ar.urgency,
        ar.urgency_rank,
        ar.target_year,
        ar.planned_year
      from active_recommendations ar
      order by
        ar.bridge_id,
        ar.urgency_rank desc,
        coalesce(ar.planned_year, ar.target_year) asc nulls last,
        ar.created_at,
        ar.id
    ),
    portfolio_base as (
      select
        b.id,
        b.external_structure_number,
        b.name,
        b.road,
        b.municipality,
        b.locality,
        b.data_origin,
        ss.construction_year,
        ss.structure_type,
        coalesce(ss.partial_structure_count, 0)::int as partial_structure_count,
        hi.condition_score,
        hi.previous_condition_score,
        hi.condition_delta,
        coalesce(hi.condition_trend, 'UNKNOWN') as condition_trend,
        hi.condition_assessed_on,
        hi.condition_inspection_type,
        ins.latest_inspection_on,
        ins.next_due_on,
        case
          when ins.next_due_on::date < ${asOf}::date then 'OVERDUE'
          when ins.next_due_on::date <= (${asOf}::date + 180) then 'DUE_SOON'
          when coalesce(ins.current_inspection_count, 0) < coalesce(ss.partial_structure_count, 0)
            or coalesce(ins.computable_inspection_count, 0) < coalesce(ss.partial_structure_count, 0)
            then 'UNKNOWN'
          when coalesce(ss.partial_structure_count, 0) = 0 then 'UNKNOWN'
          else 'CURRENT'
        end as inspection_status,
        coalesce(fs.open_findings, 0)::int as open_findings,
        coalesce(rs.open_recommendations, 0)::int as open_recommendations,
        hr.urgency as highest_recommendation_urgency,
        coalesce(hr.urgency_rank, 0)::int as highest_recommendation_urgency_rank,
        hr.id as next_recommendation_id,
        hr.description as next_recommendation_description,
        hr.urgency as next_recommendation_urgency,
        hr.target_year as next_recommendation_target_year,
        hr.planned_year as next_recommendation_planned_year,
        fs.maximum_stability,
        fs.maximum_traffic_safety,
        fs.maximum_durability,
        lt.observation_year as traffic_observation_year,
        lt.observed_on as traffic_observed_on,
        lt.daily_traffic as traffic_daily_traffic,
        lt.truck_share_percent as traffic_truck_share_percent,
        lt.source as traffic_source,
        le.freeze_thaw_days,
        le.heavy_rain_days_20,
        le.deicing_days
      from bridges b
      left join structure_summary ss on ss.bridge_id = b.id
      left join inspection_summary ins on ins.bridge_id = b.id
      left join headline_inspection hi on hi.bridge_id = b.id
      left join finding_summary fs on fs.bridge_id = b.id
      left join recommendation_summary rs on rs.bridge_id = b.id
      left join headline_recommendation hr on hr.bridge_id = b.id
      left join latest_traffic lt on lt.bridge_id = b.id
      left join latest_environment le on le.bridge_id = b.id
    ),
    portfolio as (
      select
        pb.*,
        case
          when pb.inspection_status = 'OVERDUE'
            or greatest(
              coalesce(pb.maximum_stability, 0),
              coalesce(pb.maximum_traffic_safety, 0)
            ) >= 3 then 5
          when greatest(
            coalesce(pb.maximum_stability, 0),
            coalesce(pb.maximum_traffic_safety, 0)
          ) >= 2 then 4
          when pb.inspection_status in ('DUE_SOON', 'UNKNOWN')
            or pb.condition_score is null
            or coalesce(pb.maximum_durability, 0) >= 2
            or pb.condition_trend = 'DETERIORATING'
            or pb.highest_recommendation_urgency_rank >= 2 then 3
          when pb.open_findings > 0 or pb.open_recommendations > 0 then 2
          else 1
        end as attention_priority
      from portfolio_base pb
    )
  `;
}

function buildPortfolioWhere(query: BridgePortfolioQuery): SQL {
  const filters: SQL[] = [];

  if (query.road !== undefined) {
    filters.push(sql`p.road ilike ${`%${query.road}%`}`);
  }
  if (query.conditionMin !== undefined) {
    filters.push(sql`p.condition_score >= ${query.conditionMin}`);
  }
  if (query.conditionMax !== undefined) {
    filters.push(sql`p.condition_score <= ${query.conditionMax}`);
  }
  if (query.constructionYearFrom !== undefined) {
    filters.push(sql`p.construction_year >= ${query.constructionYearFrom}`);
  }
  if (query.constructionYearTo !== undefined) {
    filters.push(sql`p.construction_year <= ${query.constructionYearTo}`);
  }
  if (query.inspectionStatus !== undefined) {
    filters.push(sql`p.inspection_status = ${query.inspectionStatus}`);
  }
  if (query.hasOpenFinding !== undefined) {
    filters.push(
      query.hasOpenFinding ? sql`p.open_findings > 0` : sql`p.open_findings = 0`
    );
  }
  if (query.recommendationUrgency !== undefined) {
    filters.push(sql`exists (
      select 1 from recommendations r
      where r.bridge_id = p.id
        and lower(r.urgency) = lower(${query.recommendationUrgency})
        and r.status in ('OPEN', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS')
    )`);
  }
  if (query.findingStatus !== undefined) {
    filters.push(sql`exists (
      select 1 from findings f
      where f.bridge_id = p.id and f.status = ${query.findingStatus}
    )`);
  }

  return filters.length === 0 ? sql`` : sql`where ${sql.join(filters, sql` and `)}`;
}

function portfolioOrderBy(query: BridgePortfolioQuery): SQL {
  const fieldBySort = {
    attention: sql`p.attention_priority`,
    condition: sql`p.condition_score`,
    latestInspection: sql`p.latest_inspection_on`,
    constructionYear: sql`p.construction_year`,
    name: sql`lower(p.name)`
  } satisfies Record<BridgePortfolioQuery["sort"], SQL>;
  const direction = query.direction === "asc" ? sql`asc` : sql`desc`;
  return sql`${fieldBySort[query.sort]} ${direction} nulls last`;
}

function mapPortfolioRow(row: PortfolioRow) {
  const attention = deriveBridgeAttention({
    conditionScore: row.conditionScore,
    conditionTrend: row.conditionTrend,
    highestRecommendationUrgencyRank: row.highestRecommendationUrgencyRank,
    inspectionStatus: row.inspectionStatus,
    maximumDurability: row.maximumDurability,
    maximumStability: row.maximumStability,
    maximumTrafficSafety: row.maximumTrafficSafety,
    openFindings: row.openFindings,
    openRecommendations: row.openRecommendations,
    hasEnvironmentalExposure: hasHighEnvironmentalExposure({
      freezeThawDays: row.freezeThawDays,
      heavyRainDays20: row.heavyRainDays20,
      deicingDays: row.deicingDays,
      maximumDurability: row.maximumDurability
    })
  });

  return {
    id: row.id,
    externalStructureNumber: row.externalStructureNumber,
    name: row.name,
    road: row.road,
    location: { municipality: row.municipality, locality: row.locality },
    dataOrigin: row.dataOrigin,
    structure: {
      constructionYear: row.constructionYear,
      structureType: row.structureType,
      partialStructureCount: row.partialStructureCount
    },
    condition: {
      score: row.conditionScore,
      previousScore: row.previousConditionScore,
      delta: row.conditionDelta,
      trend: row.conditionTrend,
      assessedOn: row.conditionAssessedOn,
      inspectionType: row.conditionInspectionType
    },
    inspection: {
      latestInspectionOn: row.latestInspectionOn,
      nextDueOn: row.nextDueOn,
      status: row.inspectionStatus
    },
    traffic:
      row.trafficObservationYear === null || row.trafficSource === null
        ? null
        : {
            observationYear: row.trafficObservationYear,
            observedOn: row.trafficObservedOn,
            dailyTraffic: row.trafficDailyTraffic,
            truckSharePercent: row.trafficTruckSharePercent,
            source: row.trafficSource
          },
    photoUrl: row.hasPhoto ? bridgePhotoUrl(row.id) : null,
    attention: {
      ...attention,
      openFindings: row.openFindings,
      openRecommendations: row.openRecommendations,
      highestRecommendationUrgency: row.highestRecommendationUrgency,
      nextRecommendation:
        row.nextRecommendationId === null
          ? null
          : {
              id: row.nextRecommendationId,
              description: row.nextRecommendationDescription,
              urgency: row.nextRecommendationUrgency,
              targetYear: row.nextRecommendationTargetYear,
              plannedYear: row.nextRecommendationPlannedYear
            },
      maximumRatings: {
        stability: row.maximumStability,
        trafficSafety: row.maximumTrafficSafety,
        durability: row.maximumDurability
      }
    }
  };
}

function mapBridgeEnvironment(input: {
  readonly asOfYear: number;
  readonly constructionYear: number | null;
  readonly crossedFeature: string | null;
  readonly dailyTraffic: number | null;
  readonly components: readonly {
    readonly type: string | null;
    readonly material: string | null;
    readonly constructionYear: number | null;
    readonly installYear: number | null;
  }[];
  readonly findings: readonly {
    readonly id: string;
    readonly defectType: string | null;
    readonly description: string | null;
    readonly sourceIdentifier: string | null;
    readonly durabilityRating: number | null;
    readonly status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
    readonly componentType: string | null;
    readonly componentMaterial: string | null;
  }[];
  readonly rows: readonly (typeof environmentalMetrics.$inferSelect)[];
}) {
  const current = input.rows[0];
  if (current === undefined) {
    return null;
  }
  const previous = input.rows[1];
  const monthlyPrecip = asNumberArray(current.monthlyPrecipMm);
  const monthlyFreezeThaw = asNumberArray(current.monthlyFreezeThawDays);

  return {
    observationYear: current.observationYear,
    source: current.source,
    sourceDescription: current.sourceDescription,
    formulaVersion: current.formulaVersion,
    policyVersion: DAMAGE_MECHANISM_POLICY_VERSION,
    location: {
      latitude: current.latitude,
      longitude: current.longitude,
      gridLatitude: current.gridLatitude,
      gridLongitude: current.gridLongitude,
      elevationM: current.elevationM
    },
    metrics: {
      freezeThawDays: current.freezeThawDays,
      frostDays: current.frostDays,
      iceDays: current.iceDays,
      wetDryCycles: current.wetDryCycles,
      meanRelativeHumidityPercent: current.meanRelativeHumidityPercent,
      precipitationHours: current.precipitationHours,
      heavyRainDays20: current.heavyRainDays20,
      heavyRainDays30: current.heavyRainDays30,
      annualPrecipMm: current.annualPrecipMm,
      deicingDays: current.deicingDays
    },
    monthly: monthlyPrecip.map((precipMm, index) => ({
      month: index + 1,
      precipMm: precipMm.toFixed(1),
      freezeThawDays: monthlyFreezeThaw[index] ?? 0
    })),
    previousYear:
      previous === undefined
        ? null
        : {
            observationYear: previous.observationYear,
            freezeThawDays: previous.freezeThawDays,
            heavyRainDays20: previous.heavyRainDays20,
            annualPrecipMm: previous.annualPrecipMm
          },
    mechanisms: deriveDamageMechanisms({
      asOfYear: input.asOfYear,
      climate: {
        freezeThawDays: current.freezeThawDays,
        wetDryCycles: current.wetDryCycles,
        meanRelativeHumidityPercent: current.meanRelativeHumidityPercent,
        precipitationHours: current.precipitationHours,
        heavyRainDays20: current.heavyRainDays20,
        deicingDays: current.deicingDays
      },
      constructionYear: input.constructionYear,
      crossedFeature: input.crossedFeature,
      dailyTraffic: input.dailyTraffic,
      components: input.components,
      findings: input.findings
    })
  };
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 12) {
    return [];
  }
  return value.map((item) => {
    const numeric = Number(item);
    return Number.isFinite(numeric) ? numeric : 0;
  });
}

function evidenceSelectColumns(
  linkAlias: "be" | "fe" | "hwe" | "ie" | "pse" | "re" | "toe"
): SQL {
  return sql.raw(`
    ${linkAlias}.evidence_id as "evidenceId",
    d.id as "documentId",
    d.type as "documentType",
    d.original_filename as "originalFilename",
    se.page_number as "pageNumber",
    se.source_excerpt as excerpt,
    se.bounding_box_x as "boundingBoxX",
    se.bounding_box_y as "boundingBoxY",
    se.bounding_box_width as "boundingBoxWidth",
    se.bounding_box_height as "boundingBoxHeight",
    se.extraction_confidence as "extractionConfidence",
    se.extraction_method as "extractionMethod",
    se.review_state as "reviewState",
    case
      when jsonb_typeof(d.metadata -> 'sourceUrl') = 'string'
        then d.metadata ->> 'sourceUrl'
      else null
    end as "documentSourceUrl",
    ${linkAlias}.field_name as "fieldName",
    ${linkAlias}.kind,
    ${linkAlias}.derivation_method as "derivationMethod"
  `);
}

function groupEvidence(rows: EvidenceRow[]): Map<string, EvidenceCitation[]> {
  const grouped = new Map<string, EvidenceCitation[]>();
  for (const row of rows) {
    const citations = grouped.get(row.entityId) ?? [];
    citations.push(mapEvidence(row));
    grouped.set(row.entityId, citations);
  }
  return grouped;
}

function mapEvidence(row: EvidenceRow): EvidenceCitation {
  const boundingBox =
    row.boundingBoxX !== null &&
    row.boundingBoxY !== null &&
    row.boundingBoxWidth !== null &&
    row.boundingBoxHeight !== null
      ? {
          x: row.boundingBoxX,
          y: row.boundingBoxY,
          width: row.boundingBoxWidth,
          height: row.boundingBoxHeight
        }
      : null;

  return {
    evidenceId: row.evidenceId,
    documentId: row.documentId,
    documentType: row.documentType,
    originalFilename: row.originalFilename,
    pageNumber: row.pageNumber,
    excerpt: row.excerpt,
    boundingBox,
    extractionConfidence: row.extractionConfidence,
    extractionMethod: row.extractionMethod,
    reviewState: row.reviewState,
    fieldName: row.fieldName,
    kind: row.kind,
    derivationMethod: row.derivationMethod,
    viewSourceUrl: buildDocumentSourceUrl(row.documentSourceUrl, row.pageNumber)
  };
}

function groupFindingRecommendations(
  rows: FindingRecommendationRow[]
): Map<string, BridgeFindingsResponse["data"][number]["linkedRecommendations"]> {
  const grouped = new Map<
    string,
    BridgeFindingsResponse["data"][number]["linkedRecommendations"]
  >();
  for (const row of rows) {
    const linked = grouped.get(row.findingId) ?? [];
    linked.push({
      id: row.recommendationId,
      workType: row.workType,
      description: row.description,
      urgency: row.urgency,
      status: row.status,
      targetYear: row.targetYear,
      plannedYear: row.plannedYear
    });
    grouped.set(row.findingId, linked);
  }
  return grouped;
}

function groupRecommendationFindings(
  rows: RecommendationFindingRow[]
): Map<string, BridgeRecommendationsResponse["data"][number]["linkedFindings"]> {
  const grouped = new Map<
    string,
    BridgeRecommendationsResponse["data"][number]["linkedFindings"]
  >();
  for (const row of rows) {
    const linked = grouped.get(row.recommendationId) ?? [];
    linked.push({
      id: row.findingId,
      sourceIdentifier: row.sourceIdentifier,
      defectType: row.defectType,
      description: row.description,
      status: row.status
    });
    grouped.set(row.recommendationId, linked);
  }
  return grouped;
}

function groupEarliestInspectionDate(
  rows: RecommendationFindingRow[]
): Map<string, string> {
  const grouped = new Map<string, string>();
  for (const row of rows) {
    if (row.inspectedOn === null) continue;
    const earliest = grouped.get(row.recommendationId);
    if (earliest === undefined || row.inspectedOn < earliest) {
      grouped.set(row.recommendationId, row.inspectedOn);
    }
  }
  return grouped;
}

function inspectionTitle(type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null): string {
  const titles = {
    MAIN: "Main inspection",
    SIMPLE: "Simple inspection",
    SPECIAL: "Special inspection",
    OTHER: "Other inspection"
  } as const;
  return type === null ? "Inspection" : titles[type];
}
