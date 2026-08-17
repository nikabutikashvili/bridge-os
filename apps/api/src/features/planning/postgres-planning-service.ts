import {
  createPlannedInterventionResponseSchema,
  planningResponseSchema,
  type CreatePlannedIntervention,
  type InspectionDueStatus,
  type PlanningItem,
  type PlanningPriorityLevel,
  type PlanningQuery,
  type PlanningResponse,
  type PlanningView
} from "@bridge-os/contracts";
import {
  bridges,
  environmentalMetrics,
  findings,
  inspections,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import {
  desc,
  eq,
  inArray,
  isNotNull,
  or,
  sql
} from "drizzle-orm";

import { hasHighEnvironmentalExposure } from "../bridges/climate-exposure.js";
import { adjustForConstructionPriceInflation } from "../budget/inflation-adjustment.js";
import { deriveInspectionDueStatus } from "./inspection-due.js";
import { deriveMaintenancePriority } from "./prioritization.js";
import type {
  CreateInterventionResult,
  PlanningService
} from "./planning-service.js";

const activeRecommendationStatuses: (
  | "OPEN"
  | "APPROVED"
  | "SCHEDULED"
  | "IN_PROGRESS"
)[] = [
  "OPEN",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS"
];

type Clock = () => Date;

type BaseRow = Awaited<ReturnType<PostgresPlanningService["loadBaseRows"]>>[number];
type FindingRow = Awaited<ReturnType<PostgresPlanningService["loadFindingRows"]>>[number];
type InspectionRow = Awaited<
  ReturnType<PostgresPlanningService["loadInspectionRows"]>
>[number];
type TrafficRow = Awaited<ReturnType<PostgresPlanningService["loadTrafficRows"]>>[number];
type EnvironmentRow = Awaited<
  ReturnType<PostgresPlanningService["loadEnvironmentRows"]>
>[number];

interface InspectionContext {
  readonly conditionDelta: string | null;
  readonly status: InspectionDueStatus;
}

const levelOrder: Record<PlanningPriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export class PostgresPlanningService implements PlanningService {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async list(query: PlanningQuery): Promise<PlanningResponse> {
    const asOf = this.currentDate();
    const baseRows = await this.loadBaseRows();
    if (baseRows.length === 0) {
      return planningResponseSchema.parse({
        asOf,
        data: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          totalItems: 0,
          totalPages: 0
        },
        summary: emptySummary(),
        view: query.view
      });
    }

    const recommendationIds = baseRows.map((row) => row.recommendationId);
    const bridgeIds = [...new Set(baseRows.map((row) => row.bridgeId))];
    const partialStructureIds = [
      ...new Set(baseRows.map((row) => row.partialStructureId))
    ];
    const [findingRows, inspectionRows, trafficRows, environmentRows] = await Promise.all([
      this.loadFindingRows(recommendationIds),
      this.loadInspectionRows(partialStructureIds),
      this.loadTrafficRows(bridgeIds),
      this.loadEnvironmentRows(bridgeIds)
    ]);
    const findingsByRecommendation = groupFindings(findingRows);
    const inspectionByPartialStructure = buildInspectionContext(
      inspectionRows,
      asOf
    );
    const trafficByBridge = latestTrafficByBridge(trafficRows);
    const environmentByBridge = latestEnvironmentByBridge(environmentRows);

    const items = baseRows.map((row) =>
      mapPlanningItem(
        row,
        findingsByRecommendation.get(row.recommendationId) ?? [],
        inspectionByPartialStructure.get(row.partialStructureId) ?? {
          conditionDelta: null,
          status: "UNKNOWN"
        },
        trafficByBridge.get(row.bridgeId)?.dailyTraffic ?? null,
        environmentByBridge.get(row.bridgeId) ?? null,
        asOf
      )
    );
    const summary = summarize(items);
    const matchingItems = items
      .filter((item) => itemView(item) === query.view)
      .sort(comparePlanningItems);
    const offset = (query.page - 1) * query.pageSize;
    const data = matchingItems.slice(offset, offset + query.pageSize);

    return planningResponseSchema.parse({
      asOf,
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: matchingItems.length,
        totalPages: Math.ceil(matchingItems.length / query.pageSize)
      },
      summary,
      view: query.view
    });
  }

  public async createFromRecommendation(
    input: CreatePlannedIntervention
  ): Promise<CreateInterventionResult> {
    return this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{
        bridgeId: string;
        id: string;
        partialStructureId: string;
        status:
          | "OPEN"
          | "APPROVED"
          | "SCHEDULED"
          | "IN_PROGRESS"
          | "COMPLETED"
          | "CANCELLED"
          | null;
      }>(sql`
        select
          ${recommendations.id} as id,
          ${recommendations.bridgeId} as "bridgeId",
          ${recommendations.partialStructureId} as "partialStructureId",
          ${recommendations.status} as status
        from ${recommendations}
        where ${recommendations.id} = ${input.recommendationId}
        for update
      `);
      const recommendation = locked.rows[0];
      if (recommendation === undefined) {
        return {
          outcome: "RECOMMENDATION_NOT_FOUND",
          recommendationId: input.recommendationId
        };
      }
      if (
        recommendation.status === "COMPLETED" ||
        recommendation.status === "CANCELLED"
      ) {
        return {
          outcome: "RECOMMENDATION_NOT_ACTIONABLE",
          recommendationId: recommendation.id
        };
      }

      const [existing] = await transaction
        .select({ id: plannedInterventions.id })
        .from(plannedInterventions)
        .where(eq(plannedInterventions.recommendationId, recommendation.id))
        .limit(1);
      if (existing !== undefined) {
        return {
          interventionId: existing.id,
          outcome: "INTERVENTION_ALREADY_EXISTS",
          recommendationId: recommendation.id
        };
      }

      const [created] = await transaction
        .insert(plannedInterventions)
        .values({
          recommendationId: recommendation.id,
          bridgeId: recommendation.bridgeId,
          partialStructureId: recommendation.partialStructureId,
          workType: input.workType,
          plannedYear: input.plannedYear,
          quantity: input.quantity?.value ?? null,
          unit: input.quantity?.unit ?? null,
          estimatedCost: input.estimatedCost?.amount ?? null,
          estimatedCostCurrency: input.estimatedCost?.currency ?? null,
          estimatedCostSource:
            input.estimatedCost === null || input.estimatedCost === undefined
              ? null
              : "USER_PLANNING",
          estimatedCostStatus:
            input.estimatedCost === null || input.estimatedCost === undefined
              ? null
              : "DRAFT",
          status: "PLANNED"
        })
        .returning();
      if (created === undefined) {
        throw new Error("Planned intervention insert returned no record.");
      }

      return {
        outcome: "CREATED",
        response: createPlannedInterventionResponseSchema.parse({
          data: {
            id: created.id,
            workType: created.workType,
            plannedYear: created.plannedYear,
            quantity: pair(created.quantity, created.unit),
            estimatedCost: money(
              created.estimatedCost,
              created.estimatedCostCurrency
            ),
            estimatedCostSource: created.estimatedCostSource,
            estimatedCostStatus: created.estimatedCostStatus,
            status: created.status,
            createdAt: created.createdAt.toISOString()
          }
        })
      };
    });
  }

  private loadBaseRows() {
    return this.database
      .select({
        recommendationId: recommendations.id,
        bridgeId: recommendations.bridgeId,
        partialStructureId: recommendations.partialStructureId,
        recommendationWorkType: recommendations.workType,
        recommendationDescription: recommendations.description,
        recommendationUrgency: recommendations.urgency,
        recommendationQuantity: recommendations.quantity,
        recommendationUnit: recommendations.unit,
        sourceEstimatedCost: recommendations.sourceEstimatedCost,
        sourceEstimatedCostCurrency:
          recommendations.sourceEstimatedCostCurrency,
        recommendationTargetYear: recommendations.targetYear,
        recommendationStatus: recommendations.status,
        bridgeExternalStructureNumber: bridges.externalStructureNumber,
        bridgeName: bridges.name,
        bridgeRoad: bridges.road,
        interventionId: plannedInterventions.id,
        interventionWorkType: plannedInterventions.workType,
        interventionPlannedYear: plannedInterventions.plannedYear,
        interventionQuantity: plannedInterventions.quantity,
        interventionUnit: plannedInterventions.unit,
        interventionEstimatedCost: plannedInterventions.estimatedCost,
        interventionEstimatedCostCurrency:
          plannedInterventions.estimatedCostCurrency,
        interventionEstimatedCostSource:
          plannedInterventions.estimatedCostSource,
        interventionEstimatedCostStatus:
          plannedInterventions.estimatedCostStatus,
        interventionStatus: plannedInterventions.status,
        interventionCreatedAt: plannedInterventions.createdAt
      })
      .from(recommendations)
      .innerJoin(bridges, eq(bridges.id, recommendations.bridgeId))
      .leftJoin(
        plannedInterventions,
        eq(plannedInterventions.recommendationId, recommendations.id)
      )
      .where(
        or(
          isNotNull(plannedInterventions.id),
          inArray(recommendations.status, activeRecommendationStatuses)
        )
      );
  }

  private loadFindingRows(recommendationIds: string[]) {
    return this.database
      .select({
        recommendationId: recommendationFindings.recommendationId,
        id: findings.id,
        sourceIdentifier: findings.sourceIdentifier,
        defectType: findings.defectType,
        status: findings.status,
        stabilityRating: findings.stabilityRating,
        trafficSafetyRating: findings.trafficSafetyRating,
        durabilityRating: findings.durabilityRating,
        inspectedOn: inspections.inspectedOn
      })
      .from(recommendationFindings)
      .innerJoin(findings, eq(findings.id, recommendationFindings.findingId))
      .innerJoin(inspections, eq(inspections.id, findings.inspectionId))
      .where(inArray(recommendationFindings.recommendationId, recommendationIds));
  }

  private loadInspectionRows(partialStructureIds: string[]) {
    return this.database
      .select({
        id: inspections.id,
        partialStructureId: inspections.partialStructureId,
        inspectedOn: inspections.inspectedOn,
        conditionScore: inspections.conditionScore,
        cycleMonths: inspections.cycleMonths
      })
      .from(inspections)
      .where(inArray(inspections.partialStructureId, partialStructureIds))
      .orderBy(desc(inspections.inspectedOn), desc(inspections.id));
  }

  private loadTrafficRows(bridgeIds: string[]) {
    return this.database
      .select({
        bridgeId: trafficObservations.bridgeId,
        observationYear: trafficObservations.observationYear,
        dailyTraffic: trafficObservations.dailyTraffic
      })
      .from(trafficObservations)
      .where(inArray(trafficObservations.bridgeId, bridgeIds))
      .orderBy(
        desc(trafficObservations.observationYear),
        desc(trafficObservations.id)
      );
  }

  private loadEnvironmentRows(bridgeIds: string[]) {
    return this.database
      .select({
        bridgeId: environmentalMetrics.bridgeId,
        observationYear: environmentalMetrics.observationYear,
        freezeThawDays: environmentalMetrics.freezeThawDays,
        heavyRainDays20: environmentalMetrics.heavyRainDays20,
        deicingDays: environmentalMetrics.deicingDays
      })
      .from(environmentalMetrics)
      .where(inArray(environmentalMetrics.bridgeId, bridgeIds))
      .orderBy(desc(environmentalMetrics.observationYear), desc(environmentalMetrics.id));
  }

  private currentDate(): string {
    return this.clock().toISOString().slice(0, 10);
  }
}

function mapPlanningItem(
  row: BaseRow,
  findingRows: readonly FindingRow[],
  inspection: InspectionContext,
  dailyTraffic: number | null,
  environment: EnvironmentRow | null,
  asOf: string
): PlanningItem {
  const activeFindingRows = findingRows.filter(
    (finding) => finding.status === "OPEN" || finding.status === "MONITORING"
  );
  const sourceDate = findingRows
    .map((finding) => finding.inspectedOn)
    .filter((date): date is string => date !== null)
    .sort()[0] ?? null;
  const sourceEstimatedCost = money(
    row.sourceEstimatedCost,
    row.sourceEstimatedCostCurrency
  );
  const inflationAdjustedEstimate =
    sourceEstimatedCost === null || sourceDate === null
      ? null
      : adjustForConstructionPriceInflation({
          amount: sourceEstimatedCost.amount,
          currency: sourceEstimatedCost.currency,
          sourceYear: yearOf(sourceDate),
          asOfYear: yearOf(asOf)
        });
  const priority = deriveMaintenancePriority({
    asOf,
    conditionDelta: inspection.conditionDelta,
    dailyTraffic,
    hasEnvironmentalExposure: hasHighEnvironmentalExposure({
      freezeThawDays: environment?.freezeThawDays ?? null,
      heavyRainDays20: environment?.heavyRainDays20 ?? null,
      deicingDays: environment?.deicingDays ?? null,
      maximumDurability: maximum(activeFindingRows, "durabilityRating")
    }),
    inspectionStatus: inspection.status,
    maximumDurability: maximum(activeFindingRows, "durabilityRating"),
    maximumStability: maximum(activeFindingRows, "stabilityRating"),
    maximumTrafficSafety: maximum(activeFindingRows, "trafficSafetyRating"),
    recommendationSourceDate: sourceDate,
    urgency: row.recommendationUrgency
  });

  return {
    recommendationId: row.recommendationId,
    bridge: {
      id: row.bridgeId,
      externalStructureNumber: row.bridgeExternalStructureNumber,
      name: row.bridgeName,
      road: row.bridgeRoad
    },
    sourceRecommendation: {
      id: row.recommendationId,
      workType: row.recommendationWorkType,
      description: row.recommendationDescription,
      urgency: row.recommendationUrgency,
      targetYear: row.recommendationTargetYear,
      quantity: pair(row.recommendationQuantity, row.recommendationUnit),
      sourceEstimatedCost,
      status: row.recommendationStatus,
      sourceDate,
      inflationAdjustedEstimate
    },
    plannedIntervention:
      row.interventionId === null ||
      row.interventionWorkType === null ||
      row.interventionPlannedYear === null ||
      row.interventionStatus === null ||
      row.interventionCreatedAt === null
        ? null
        : {
            id: row.interventionId,
            workType: row.interventionWorkType,
            plannedYear: row.interventionPlannedYear,
            quantity: pair(row.interventionQuantity, row.interventionUnit),
            estimatedCost: money(
              row.interventionEstimatedCost,
              row.interventionEstimatedCostCurrency
            ),
            estimatedCostSource: row.interventionEstimatedCostSource,
            estimatedCostStatus: row.interventionEstimatedCostStatus,
            status: row.interventionStatus,
            createdAt: row.interventionCreatedAt.toISOString()
          },
    linkedFindings: findingRows.map((finding) => ({
      id: finding.id,
      sourceIdentifier: finding.sourceIdentifier,
      defectType: finding.defectType,
      status: finding.status,
      ratings: {
        stability: finding.stabilityRating,
        trafficSafety: finding.trafficSafetyRating,
        durability: finding.durabilityRating
      }
    })),
    priority
  };
}

function groupFindings(rows: readonly FindingRow[]): Map<string, FindingRow[]> {
  const grouped = new Map<string, FindingRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.recommendationId) ?? [];
    existing.push(row);
    grouped.set(row.recommendationId, existing);
  }
  return grouped;
}

function buildInspectionContext(
  rows: readonly InspectionRow[],
  asOf: string
): Map<string, InspectionContext> {
  const grouped = new Map<string, InspectionRow[]>();
  for (const row of rows) {
    const existing = grouped.get(row.partialStructureId) ?? [];
    existing.push(row);
    grouped.set(row.partialStructureId, existing);
  }

  return new Map(
    [...grouped.entries()].map(([partialStructureId, inspectionsForStructure]) => {
      const dated = inspectionsForStructure.filter(
        (inspection): inspection is InspectionRow & { inspectedOn: string } =>
          inspection.inspectedOn !== null
      );
      const latest = dated[0];
      const scored = dated.filter(
        (inspection): inspection is typeof inspection & { conditionScore: string } =>
          inspection.conditionScore !== null
      );
      const conditionDelta =
        scored[0] === undefined || scored[1] === undefined
          ? null
          : (Number(scored[0].conditionScore) - Number(scored[1].conditionScore)).toFixed(
              1
            );
      return [
        partialStructureId,
        {
          conditionDelta,
          status: deriveInspectionDueStatus(latest, asOf)
        }
      ];
    })
  );
}

function latestTrafficByBridge(rows: readonly TrafficRow[]): Map<string, TrafficRow> {
  const result = new Map<string, TrafficRow>();
  for (const row of rows) {
    if (!result.has(row.bridgeId)) {
      result.set(row.bridgeId, row);
    }
  }
  return result;
}

function latestEnvironmentByBridge(
  rows: readonly EnvironmentRow[]
): Map<string, EnvironmentRow> {
  const result = new Map<string, EnvironmentRow>();
  for (const row of rows) {
    if (!result.has(row.bridgeId)) {
      result.set(row.bridgeId, row);
    }
  }
  return result;
}

function maximum(
  rows: readonly FindingRow[],
  key: "durabilityRating" | "stabilityRating" | "trafficSafetyRating"
): number | null {
  const ratings = rows
    .map((row) => row[key])
    .filter((rating): rating is number => rating !== null);
  return ratings.length === 0 ? null : Math.max(...ratings);
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

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

function itemView(item: PlanningItem): PlanningView {
  const status = item.plannedIntervention?.status;
  if (status === undefined) {
    return "recommended-unplanned";
  }
  const byStatus = {
    PLANNED: "planned",
    BUDGETED: "budgeted",
    TENDER_PREPARATION: "tender-preparation",
    TENDERED_READY: "tendered-ready",
    IN_PROGRESS: "in-progress",
    COMPLETED: "completed"
  } as const satisfies Record<typeof status, PlanningView>;
  return byStatus[status];
}

function summarize(items: readonly PlanningItem[]) {
  const summary = emptySummary();
  for (const item of items) {
    const view = itemView(item);
    const keyByView = {
      "recommended-unplanned": "recommendedUnplanned",
      planned: "planned",
      budgeted: "budgeted",
      "tender-preparation": "tenderPreparation",
      "tendered-ready": "tenderedReady",
      "in-progress": "inProgress",
      completed: "completed"
    } as const;
    summary[keyByView[view]] += 1;
  }
  return summary;
}

function emptySummary() {
  return {
    recommendedUnplanned: 0,
    planned: 0,
    budgeted: 0,
    tenderPreparation: 0,
    tenderedReady: 0,
    inProgress: 0,
    completed: 0
  };
}

function comparePlanningItems(left: PlanningItem, right: PlanningItem): number {
  const priorityDifference =
    levelOrder[right.priority.level] - levelOrder[left.priority.level];
  if (priorityDifference !== 0) {
    return priorityDifference;
  }
  const leftYear =
    left.plannedIntervention?.plannedYear ??
    left.sourceRecommendation.targetYear ??
    Number.MAX_SAFE_INTEGER;
  const rightYear =
    right.plannedIntervention?.plannedYear ??
    right.sourceRecommendation.targetYear ??
    Number.MAX_SAFE_INTEGER;
  return leftYear - rightYear || left.recommendationId.localeCompare(right.recommendationId);
}
