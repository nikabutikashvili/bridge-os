import {
  workPackageDetailResponseSchema,
  workPackageListResponseSchema,
  workPackageSnapshotSchema,
  type EvidenceCitation,
  type WorkPackageDetailResponse,
  type WorkPackageListResponse,
  type WorkPackageSnapshot
} from "@bridge-os/contracts";
import {
  bridges,
  components,
  documents,
  findings,
  inspections,
  partialStructures,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  networkMetrics,
  trafficObservations,
  workPackages,
  type BridgeDatabase
} from "@bridge-os/db";
import { and, desc, eq, ne, sql, type SQL } from "drizzle-orm";

import { deriveInspectionDueStatus } from "../planning/inspection-due.js";
import { buildDocumentSourceUrl } from "../bridges/source-url.js";
import {
  describeTrafficManagementRequirements,
  resolveHeavyVehicleDaily
} from "../bridges/network-criticality.js";
import {
  generateWorkPackage,
  summarizeReadiness,
  type WorkPackageGenerationInput
} from "./generator.js";
import type {
  CreateWorkPackageResult,
  DeleteWorkPackageResult,
  WorkPackageService
} from "./work-package-service.js";

type Clock = () => Date;

interface EvidenceRow extends Record<string, unknown> {
  boundingBoxHeight: string | null;
  boundingBoxWidth: string | null;
  boundingBoxX: string | null;
  boundingBoxY: string | null;
  derivationMethod: string | null;
  documentId: string;
  documentSourceUrl: string | null;
  documentType: string;
  entityId: string;
  entityType: WorkPackageSnapshot["evidence"]["citations"][number]["entityType"];
  evidenceId: string;
  excerpt: string | null;
  extractionConfidence: string | null;
  extractionMethod: EvidenceCitation["extractionMethod"];
  fieldName: string;
  kind: EvidenceCitation["kind"];
  originalFilename: string;
  pageNumber: number | null;
  reviewState: EvidenceCitation["reviewState"];
}

export class PostgresWorkPackageService implements WorkPackageService {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async list(): Promise<WorkPackageListResponse> {
    const [packageRows, eligibleRows] = await Promise.all([
      this.database
        .select()
        .from(workPackages)
        .orderBy(desc(workPackages.generatedAt), desc(workPackages.id)),
      this.database
        .select({
          id: plannedInterventions.id,
          workType: plannedInterventions.workType,
          plannedYear: plannedInterventions.plannedYear,
          status: plannedInterventions.status,
          quantity: plannedInterventions.quantity,
          unit: plannedInterventions.unit,
          estimatedCost: plannedInterventions.estimatedCost,
          estimatedCostCurrency: plannedInterventions.estimatedCostCurrency,
          estimatedCostSource: plannedInterventions.estimatedCostSource,
          bridgeId: bridges.id,
          bridgeExternalStructureNumber: bridges.externalStructureNumber,
          bridgeName: bridges.name,
          bridgeRoad: bridges.road
        })
        .from(plannedInterventions)
        .innerJoin(bridges, eq(bridges.id, plannedInterventions.bridgeId))
        .leftJoin(
          workPackages,
          eq(workPackages.plannedInterventionId, plannedInterventions.id)
        )
        .where(
          and(
            ne(plannedInterventions.status, "COMPLETED"),
            sql`${workPackages.id} is null`
          )
        )
        .orderBy(
          plannedInterventions.plannedYear,
          plannedInterventions.workType,
          plannedInterventions.id
        )
    ]);

    return workPackageListResponseSchema.parse({
      data: packageRows.map((row) => {
        const snapshot = workPackageSnapshotSchema.parse(row.snapshot);
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          snapshotVersion: row.snapshotVersion,
          generatedAt: row.generatedAt.toISOString(),
          bridge: pickBridge(snapshot.asset.bridge),
          workType: snapshot.scope.workType,
          plannedYear: snapshot.scope.plannedYear,
          readiness: summarizeReadiness(snapshot.readiness)
        };
      }),
      eligibleInterventions: eligibleRows.map((row) => ({
        id: row.id,
        workType: row.workType,
        plannedYear: row.plannedYear,
        status: row.status,
        quantity: pair(row.quantity, row.unit),
        planningEstimate: money(row.estimatedCost, row.estimatedCostCurrency),
        estimateSource: row.estimatedCostSource,
        bridge: {
          id: row.bridgeId,
          externalStructureNumber: row.bridgeExternalStructureNumber,
          name: row.bridgeName,
          road: row.bridgeRoad
        }
      }))
    });
  }

  public async get(id: string): Promise<WorkPackageDetailResponse | null> {
    const [row] = await this.database
      .select()
      .from(workPackages)
      .where(eq(workPackages.id, id))
      .limit(1);
    return row === undefined ? null : detailResponse(row);
  }

  public async create(
    input: { readonly plannedInterventionId: string }
  ): Promise<CreateWorkPackageResult> {
    return this.database.transaction(async (transaction) => {
      const [base] = await transaction
        .select({
          interventionId: plannedInterventions.id,
          interventionWorkType: plannedInterventions.workType,
          interventionPlannedYear: plannedInterventions.plannedYear,
          interventionStatus: plannedInterventions.status,
          interventionQuantity: plannedInterventions.quantity,
          interventionUnit: plannedInterventions.unit,
          interventionEstimatedCost: plannedInterventions.estimatedCost,
          interventionEstimatedCostCurrency:
            plannedInterventions.estimatedCostCurrency,
          interventionEstimatedCostSource:
            plannedInterventions.estimatedCostSource,
          interventionEstimatedCostStatus:
            plannedInterventions.estimatedCostStatus,
          recommendationId: recommendations.id,
          recommendationDescription: recommendations.description,
          recommendationUrgency: recommendations.urgency,
          recommendationQuantity: recommendations.quantity,
          recommendationUnit: recommendations.unit,
          sourceEstimatedCost: recommendations.sourceEstimatedCost,
          sourceEstimatedCostCurrency:
            recommendations.sourceEstimatedCostCurrency,
          bridgeId: bridges.id,
          bridgeExternalStructureNumber: bridges.externalStructureNumber,
          bridgeName: bridges.name,
          bridgeRoad: bridges.road,
          bridgeFederalState: bridges.federalState,
          bridgeDistrict: bridges.district,
          bridgeMunicipality: bridges.municipality,
          bridgeLocality: bridges.locality,
          bridgeCrossedFeature: bridges.crossedFeature,
          responsibleAuthority: bridges.responsibleAuthority,
          maintenanceOffice: bridges.maintenanceOffice,
          partialStructureId: partialStructures.id,
          partialStructureExternalNumber:
            partialStructures.externalPartialStructureNumber,
          partialStructureName: partialStructures.name,
          constructionYear: partialStructures.constructionYear,
          structureType: partialStructures.structureType,
          structuralSystem: partialStructures.structuralSystem,
          lengthM: partialStructures.lengthM,
          widthM: partialStructures.widthM,
          areaSqM: partialStructures.areaSqM,
          clearHeightM: partialStructures.clearHeightM,
          spanCount: partialStructures.spanCount
        })
        .from(plannedInterventions)
        .innerJoin(
          recommendations,
          eq(recommendations.id, plannedInterventions.recommendationId)
        )
        .innerJoin(bridges, eq(bridges.id, plannedInterventions.bridgeId))
        .innerJoin(
          partialStructures,
          eq(partialStructures.id, plannedInterventions.partialStructureId)
        )
        .where(eq(plannedInterventions.id, input.plannedInterventionId))
        .for("update")
        .limit(1);
      if (base === undefined) {
        return {
          outcome: "INTERVENTION_NOT_FOUND",
          plannedInterventionId: input.plannedInterventionId
        };
      }
      if (base.interventionStatus === "COMPLETED") {
        return {
          outcome: "INTERVENTION_NOT_ACTIONABLE",
          plannedInterventionId: input.plannedInterventionId
        };
      }
      const [existing] = await transaction
        .select({ id: workPackages.id })
        .from(workPackages)
        .where(
          eq(workPackages.plannedInterventionId, input.plannedInterventionId)
        )
        .limit(1);
      if (existing !== undefined) {
        return {
          outcome: "WORK_PACKAGE_ALREADY_EXISTS",
          plannedInterventionId: input.plannedInterventionId,
          workPackageId: existing.id
        };
      }

      const findingRows = await transaction
            .select({
              id: findings.id,
              sourceIdentifier: findings.sourceIdentifier,
              defectType: findings.defectType,
              description: findings.description,
              location: findings.location,
              extent: findings.extent,
              quantity: findings.quantity,
              quantityUnit: findings.quantityUnit,
              stabilityRating: findings.stabilityRating,
              trafficSafetyRating: findings.trafficSafetyRating,
              durabilityRating: findings.durabilityRating,
              status: findings.status,
              componentId: components.id,
              componentType: components.type,
              componentName: components.name,
              componentLocation: components.location,
              componentMaterial: components.material,
              componentConstructionYear: components.constructionYear,
              componentInstallYear: components.installYear,
              componentAdditionalProperties: components.additionalProperties,
              inspectionId: inspections.id,
              inspectionType: inspections.type,
              inspectedOn: inspections.inspectedOn,
              inspector: inspections.inspector,
              conditionScore: inspections.conditionScore
            })
            .from(recommendationFindings)
            .innerJoin(findings, eq(findings.id, recommendationFindings.findingId))
            .innerJoin(inspections, eq(inspections.id, findings.inspectionId))
            .leftJoin(components, eq(components.id, findings.componentId))
            .where(
              eq(recommendationFindings.recommendationId, base.recommendationId)
            )
            .orderBy(findings.sourceIdentifier, findings.id);
      const latestInspectionRows = await transaction
            .select({
              id: inspections.id,
              type: inspections.type,
              inspectedOn: inspections.inspectedOn,
              inspector: inspections.inspector,
              conditionScore: inspections.conditionScore,
              cycleMonths: inspections.cycleMonths
            })
            .from(inspections)
            .where(eq(inspections.partialStructureId, base.partialStructureId))
            .orderBy(desc(inspections.inspectedOn), desc(inspections.id))
            .limit(1);
      const trafficRows = await transaction
            .select({
              id: trafficObservations.id,
              observationYear: trafficObservations.observationYear,
              observedOn: trafficObservations.observedOn,
              dailyTraffic: trafficObservations.dailyTraffic,
              heavyVehicleDaily: trafficObservations.heavyVehicleDaily,
              truckSharePercent: trafficObservations.truckSharePercent
            })
            .from(trafficObservations)
            .where(eq(trafficObservations.bridgeId, base.bridgeId))
            .orderBy(
              desc(trafficObservations.observationYear),
              desc(trafficObservations.observedOn),
              desc(trafficObservations.id)
            )
            .limit(1);
      const networkRows = await transaction
            .select({
              additionalDistanceKm: networkMetrics.additionalDistanceKm,
              alternativeCrossingCount: networkMetrics.alternativeCrossingCount,
              closureDetourKm: networkMetrics.closureDetourKm,
              normalTripKm: networkMetrics.normalTripKm
            })
            .from(networkMetrics)
            .where(eq(networkMetrics.bridgeId, base.bridgeId))
            .limit(1);
      const documentRows = await transaction
            .select({
              id: documents.id,
              type: documents.type,
              originalFilename: documents.originalFilename,
              status: documents.status,
              metadata: documents.metadata
            })
            .from(documents)
            .where(eq(documents.bridgeId, base.bridgeId))
            .orderBy(documents.type, documents.originalFilename);

      const findingIds = findingRows.map((row) => row.id);
      const inspectionIds = [
        ...new Set(findingRows.map((row) => row.inspectionId))
      ];
      const componentIds = [
        ...new Set(
          findingRows
            .map((row) => row.componentId)
            .filter((id): id is string => id !== null)
        )
      ];
      const trafficId = trafficRows[0]?.id ?? null;
      const evidenceResult = await transaction.execute<EvidenceRow>(sql`
        with related as (
          select 'BRIDGE'::text as entity_type, be.bridge_id as entity_id,
            be.evidence_id, be.field_name, be.kind, be.derivation_method
          from bridge_evidence be where be.bridge_id = ${base.bridgeId}
          union all
          select 'PARTIAL_STRUCTURE', pse.partial_structure_id, pse.evidence_id,
            pse.field_name, pse.kind, pse.derivation_method
          from partial_structure_evidence pse
          where pse.partial_structure_id = ${base.partialStructureId}
          union all
          select 'RECOMMENDATION', re.recommendation_id, re.evidence_id,
            re.field_name, re.kind, re.derivation_method
          from recommendation_evidence re
          where re.recommendation_id = ${base.recommendationId}
          union all
          select 'FINDING', fe.finding_id, fe.evidence_id,
            fe.field_name, fe.kind, fe.derivation_method
          from finding_evidence fe where fe.finding_id in (${uuidList(findingIds)})
          union all
          select 'INSPECTION', ie.inspection_id, ie.evidence_id,
            ie.field_name, ie.kind, ie.derivation_method
          from inspection_evidence ie where ie.inspection_id in (${uuidList(inspectionIds)})
          union all
          select 'COMPONENT', ce.component_id, ce.evidence_id,
            ce.field_name, ce.kind, ce.derivation_method
          from component_evidence ce where ce.component_id in (${uuidList(componentIds)})
          union all
          select 'TRAFFIC_OBSERVATION', toe.traffic_observation_id, toe.evidence_id,
            toe.field_name, toe.kind, toe.derivation_method
          from traffic_observation_evidence toe
          where toe.traffic_observation_id in (${uuidList(trafficId === null ? [] : [trafficId])})
        )
        select
          related.entity_type as "entityType",
          related.entity_id as "entityId",
          related.evidence_id as "evidenceId",
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
          case when jsonb_typeof(d.metadata -> 'sourceUrl') = 'string'
            then d.metadata ->> 'sourceUrl' else null end as "documentSourceUrl",
          related.field_name as "fieldName",
          related.kind,
          related.derivation_method as "derivationMethod"
        from related
        join source_evidence se on se.id = related.evidence_id
        join documents d on d.id = se.document_id
        order by related.entity_type, related.entity_id, se.page_number nulls last,
          related.field_name
      `);
      const generatedAt = this.clock().toISOString();
      const generated = generateWorkPackage(
        generationInput({
          base,
          findingRows,
          latestInspection: latestInspectionRows[0],
          traffic: trafficRows[0],
          network: networkRows[0],
          documentRows,
          evidenceRows: evidenceResult.rows,
          generatedAt
        })
      );
      const [created] = await transaction
        .insert(workPackages)
        .values({
          plannedInterventionId: base.interventionId,
          recommendationId: base.recommendationId,
          bridgeId: base.bridgeId,
          partialStructureId: base.partialStructureId,
          title: generated.title,
          status: "DRAFT",
          snapshotVersion: 1,
          snapshot: generated.snapshot,
          generatedAt: new Date(generatedAt)
        })
        .returning();
      if (created === undefined) {
        throw new Error("Work package insert returned no record.");
      }
      // Only advance a still-BUDGETED intervention into tender preparation;
      // an intervention that skipped budgeting (still PLANNED) is left
      // alone rather than silently jumping a lifecycle stage.
      if (base.interventionStatus === "BUDGETED") {
        await transaction
          .update(plannedInterventions)
          .set({ status: "TENDER_PREPARATION", updatedAt: new Date() })
          .where(eq(plannedInterventions.id, base.interventionId));
      }
      return { outcome: "CREATED", response: detailResponse(created) };
    });
  }

  public async remove(id: string): Promise<DeleteWorkPackageResult> {
    return this.database.transaction(async (transaction) => {
      const [workPackage] = await transaction
        .select({
          id: workPackages.id,
          plannedInterventionId: workPackages.plannedInterventionId
        })
        .from(workPackages)
        .where(eq(workPackages.id, id))
        .for("update")
        .limit(1);
      if (workPackage === undefined) {
        return { outcome: "WORK_PACKAGE_NOT_FOUND", workPackageId: id };
      }

      const [intervention] = await transaction
        .select({
          id: plannedInterventions.id,
          status: plannedInterventions.status
        })
        .from(plannedInterventions)
        .where(eq(plannedInterventions.id, workPackage.plannedInterventionId))
        .for("update")
        .limit(1);

      await transaction.delete(workPackages).where(eq(workPackages.id, id));

      // Symmetric with creation: only revert an intervention still sitting
      // at the status this work package would have advanced it to; leave a
      // further-along lifecycle (TENDERED_READY, IN_PROGRESS, ...) untouched.
      if (intervention?.status === "TENDER_PREPARATION") {
        await transaction
          .update(plannedInterventions)
          .set({ status: "BUDGETED", updatedAt: new Date() })
          .where(eq(plannedInterventions.id, intervention.id));
      }

      return {
        outcome: "DELETED",
        plannedInterventionId: workPackage.plannedInterventionId
      };
    });
  }
}

function generationInput(context: {
  readonly base: {
    readonly interventionId: string;
    readonly interventionWorkType: string;
    readonly interventionPlannedYear: number;
    readonly interventionQuantity: string | null;
    readonly interventionUnit: string | null;
    readonly interventionEstimatedCost: string | null;
    readonly interventionEstimatedCostCurrency: string | null;
    readonly interventionEstimatedCostSource: "USER_PLANNING" | "EXTERNAL_ENRICHED" | null;
    readonly interventionEstimatedCostStatus: "DRAFT" | "REVIEWED" | null;
    readonly recommendationId: string;
    readonly recommendationDescription: string | null;
    readonly recommendationUrgency: string | null;
    readonly recommendationQuantity: string | null;
    readonly recommendationUnit: string | null;
    readonly sourceEstimatedCost: string | null;
    readonly sourceEstimatedCostCurrency: string | null;
    readonly bridgeId: string;
    readonly bridgeExternalStructureNumber: string | null;
    readonly bridgeName: string | null;
    readonly bridgeRoad: string | null;
    readonly bridgeFederalState: string | null;
    readonly bridgeDistrict: string | null;
    readonly bridgeMunicipality: string | null;
    readonly bridgeLocality: string | null;
    readonly bridgeCrossedFeature: string | null;
    readonly responsibleAuthority: string | null;
    readonly maintenanceOffice: string | null;
    readonly partialStructureId: string;
    readonly partialStructureExternalNumber: string | null;
    readonly partialStructureName: string | null;
    readonly constructionYear: number | null;
    readonly structureType: string | null;
    readonly structuralSystem: string | null;
    readonly lengthM: string | null;
    readonly widthM: string | null;
    readonly areaSqM: string | null;
    readonly clearHeightM: string | null;
    readonly spanCount: number | null;
  };
  readonly findingRows: readonly FindingContextRow[];
  readonly latestInspection: LatestInspectionRow | undefined;
  readonly traffic: TrafficRow | undefined;
  readonly network: NetworkRow | undefined;
  readonly documentRows: readonly DocumentRow[];
  readonly evidenceRows: readonly EvidenceRow[];
  readonly generatedAt: string;
}): WorkPackageGenerationInput {
  const { base } = context;
  const componentsById = new Map<string, WorkPackageGenerationInput["components"][number]>();
  for (const row of context.findingRows) {
    if (row.componentId !== null && !componentsById.has(row.componentId)) {
      componentsById.set(row.componentId, {
        id: row.componentId,
        type: row.componentType,
        name: row.componentName,
        location: row.componentLocation,
        material: row.componentMaterial,
        constructionYear: row.componentConstructionYear,
        installYear: row.componentInstallYear,
        additionalProperties: row.componentAdditionalProperties
      });
    }
  }
  const inspectionsById = new Map<string, WorkPackageGenerationInput["sourceInspections"][number]>();
  for (const row of context.findingRows) {
    if (!inspectionsById.has(row.inspectionId)) {
      inspectionsById.set(row.inspectionId, {
        id: row.inspectionId,
        type: row.inspectionType,
        inspectedOn: row.inspectedOn,
        inspector: row.inspector,
        conditionScore: row.conditionScore
      });
    }
  }
  const latest = context.latestInspection;
  const asOf = context.generatedAt.slice(0, 10);
  return {
    generatedAt: context.generatedAt,
    asset: {
      bridge: {
        id: base.bridgeId,
        externalStructureNumber: base.bridgeExternalStructureNumber,
        name: base.bridgeName,
        road: base.bridgeRoad,
        location: {
          federalState: base.bridgeFederalState,
          district: base.bridgeDistrict,
          municipality: base.bridgeMunicipality,
          locality: base.bridgeLocality,
          crossedFeature: base.bridgeCrossedFeature
        },
        responsibleAuthority: base.responsibleAuthority,
        maintenanceOffice: base.maintenanceOffice
      },
      partialStructure: {
        id: base.partialStructureId,
        externalNumber: base.partialStructureExternalNumber,
        name: base.partialStructureName
      }
    },
    intervention: {
      id: base.interventionId,
      workType: base.interventionWorkType,
      plannedYear: base.interventionPlannedYear,
      quantity: pair(base.interventionQuantity, base.interventionUnit),
      planningEstimate: money(
        base.interventionEstimatedCost,
        base.interventionEstimatedCostCurrency
      ),
      estimateSource: base.interventionEstimatedCostSource,
      estimateStatus: base.interventionEstimatedCostStatus
    },
    recommendation: {
      id: base.recommendationId,
      description: base.recommendationDescription,
      urgency: base.recommendationUrgency,
      quantity: pair(base.recommendationQuantity, base.recommendationUnit),
      sourceEstimatedCost: money(
        base.sourceEstimatedCost,
        base.sourceEstimatedCostCurrency
      )
    },
    components: [...componentsById.values()],
    findings: context.findingRows.map((row) => ({
      id: row.id,
      sourceIdentifier: row.sourceIdentifier,
      defectType: row.defectType,
      description: row.description,
      location: row.location,
      extent: row.extent,
      quantity: pair(row.quantity, row.quantityUnit),
      ratings: {
        stability: row.stabilityRating,
        trafficSafety: row.trafficSafetyRating,
        durability: row.durabilityRating
      },
      status: row.status,
      componentId: row.componentId,
      inspectionId: row.inspectionId
    })),
    sourceInspections: [...inspectionsById.values()],
    latestInspection:
      latest === undefined
        ? null
        : {
            id: latest.id,
            type: latest.type,
            inspectedOn: latest.inspectedOn,
            inspector: latest.inspector,
            conditionScore: latest.conditionScore,
            dueStatus: deriveInspectionDueStatus(latest, asOf)
          },
    traffic:
      context.traffic === undefined
        ? null
        : {
            observationYear: context.traffic.observationYear,
            observedOn: context.traffic.observedOn,
            dailyTraffic: context.traffic.dailyTraffic,
            heavyVehicleDaily: context.traffic.heavyVehicleDaily,
            truckSharePercent: context.traffic.truckSharePercent
          },
    citations: context.evidenceRows.map(mapEvidence),
    documents: context.documentRows.map((document) => ({
      id: document.id,
      type: document.type,
      originalFilename: document.originalFilename,
      status: document.status,
      evidencePages: evidencePages(context.evidenceRows, document.id),
      isDrawing: isDocumentKind(document, "DRAWING"),
      isPhoto: isDocumentKind(document, "PHOTO"),
      viewSourceUrl: buildDocumentSourceUrl(sourceUrl(document.metadata), null)
    })),
    technicalContext: {
      constructionYear: base.constructionYear,
      structureType: base.structureType,
      structuralSystem: base.structuralSystem,
      dimensions: {
        lengthM: base.lengthM,
        widthM: base.widthM,
        areaSqM: base.areaSqM,
        clearHeightM: base.clearHeightM,
        spanCount: base.spanCount
      }
    },
    inspectionAccessEquipment: null,
    knownConstraints: [],
    trafficManagementRequirements:
      context.network === undefined
        ? null
        : describeTrafficManagementRequirements({
            additionalDistanceKm: context.network.additionalDistanceKm,
            alternativeCrossingCount: context.network.alternativeCrossingCount,
            closureDetourKm: context.network.closureDetourKm,
            heavyVehicleDaily: resolveHeavyVehicleDaily({
              dailyTraffic: context.traffic?.dailyTraffic ?? null,
              heavyVehicleDaily: context.traffic?.heavyVehicleDaily ?? null,
              truckSharePercent: context.traffic?.truckSharePercent ?? null
            }),
            normalTripKm: context.network.normalTripKm
          })
  };
}

interface FindingContextRow {
  readonly id: string;
  readonly sourceIdentifier: string | null;
  readonly defectType: string | null;
  readonly description: string | null;
  readonly location: string | null;
  readonly extent: string | null;
  readonly quantity: string | null;
  readonly quantityUnit: string | null;
  readonly stabilityRating: number | null;
  readonly trafficSafetyRating: number | null;
  readonly durabilityRating: number | null;
  readonly status: "OPEN" | "MONITORING" | "RESOLVED" | "DISMISSED" | null;
  readonly componentId: string | null;
  readonly componentType: string | null;
  readonly componentName: string | null;
  readonly componentLocation: string | null;
  readonly componentMaterial: string | null;
  readonly componentConstructionYear: number | null;
  readonly componentInstallYear: number | null;
  readonly componentAdditionalProperties: Record<string, boolean | number | string | null> | null;
  readonly inspectionId: string;
  readonly inspectionType: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null;
  readonly inspectedOn: string | null;
  readonly inspector: string | null;
  readonly conditionScore: string | null;
}

interface LatestInspectionRow {
  readonly id: string;
  readonly type: "MAIN" | "SIMPLE" | "SPECIAL" | "OTHER" | null;
  readonly inspectedOn: string | null;
  readonly inspector: string | null;
  readonly conditionScore: string | null;
  readonly cycleMonths: number | null;
}

interface TrafficRow {
  readonly id: string;
  readonly observationYear: number;
  readonly observedOn: string | null;
  readonly dailyTraffic: number | null;
  readonly heavyVehicleDaily: number | null;
  readonly truckSharePercent: string | null;
}

interface NetworkRow {
  readonly additionalDistanceKm: string | null;
  readonly alternativeCrossingCount: number | null;
  readonly closureDetourKm: string | null;
  readonly normalTripKm: string | null;
}

interface DocumentRow {
  readonly id: string;
  readonly type: string;
  readonly originalFilename: string;
  readonly status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  readonly metadata: Record<string, boolean | number | string | null> | null;
}

function evidencePages(rows: readonly EvidenceRow[], documentId: string): number[] {
  return [
    ...new Set(
      rows
        .filter((row) => row.documentId === documentId)
        .map((row) => row.pageNumber)
        .filter((page): page is number => page !== null)
    )
  ].sort((left, right) => left - right);
}

function detailResponse(row: typeof workPackages.$inferSelect): WorkPackageDetailResponse {
  return workPackageDetailResponseSchema.parse({
    data: {
      id: row.id,
      title: row.title,
      status: row.status,
      snapshotVersion: row.snapshotVersion,
      generatedAt: row.generatedAt.toISOString(),
      snapshot: workPackageSnapshotSchema.parse(row.snapshot)
    }
  });
}

function mapEvidence(row: EvidenceRow): WorkPackageSnapshot["evidence"]["citations"][number] {
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
    entityType: row.entityType,
    entityId: row.entityId,
    citation: {
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
      viewSourceUrl: buildDocumentSourceUrl(
        row.documentSourceUrl,
        row.pageNumber
      )
    }
  };
}

function uuidList(ids: readonly string[]): SQL {
  return ids.length === 0
    ? sql`null`
    : sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
}

function pair(
  value: string | null,
  unit: string | null
): { value: string; unit: string } | null {
  return value === null || unit === null ? null : { value, unit };
}

function money(
  amount: string | null,
  currency: string | null
): { amount: string; currency: string } | null {
  return amount === null || currency === null ? null : { amount, currency };
}

function pickBridge(bridge: WorkPackageSnapshot["asset"]["bridge"]) {
  return {
    id: bridge.id,
    externalStructureNumber: bridge.externalStructureNumber,
    name: bridge.name,
    road: bridge.road
  };
}

function sourceUrl(
  metadata: Record<string, boolean | number | string | null> | null
): string | null {
  const value = metadata?.["sourceUrl"];
  return typeof value === "string" ? value : null;
}

function isDocumentKind(
  document: Pick<DocumentRow, "originalFilename" | "type">,
  kind: "DRAWING" | "PHOTO"
): boolean {
  const value = `${document.type} ${document.originalFilename}`.toLocaleUpperCase("de-DE");
  return kind === "DRAWING"
    ? /(?:DRAWING|ZEICHNUNG|BAUWERKSPLAN|BESTANDSPLAN)/u.test(value)
    : /(?:PHOTO|FOTO|BILD)/u.test(value);
}
