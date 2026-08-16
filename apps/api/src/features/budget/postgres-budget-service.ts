import {
  budgetResponseSchema,
  type BudgetItem,
  type BudgetQuery,
  type BudgetResponse,
  type UpdateBudget,
  type UpdateBudgetMembership
} from "@bridge-os/contracts";
import {
  bridges,
  budgetProgramInterventions,
  budgetPrograms,
  findings,
  inspections,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { deriveInspectionDueStatus } from "../planning/inspection-due.js";
import { deriveMaintenancePriority } from "../planning/prioritization.js";
import { orderBudgetItems, summarizeBudget } from "./calculations.js";
import type {
  BudgetService,
  UpdateBudgetMembershipResult
} from "./budget-service.js";

type Clock = () => Date;
type BaseRow = Awaited<ReturnType<PostgresBudgetService["loadBaseRows"]>>[number];
type FindingRow = Awaited<ReturnType<PostgresBudgetService["loadFindingRows"]>>[number];
type InspectionRow = Awaited<ReturnType<PostgresBudgetService["loadInspectionRows"]>>[number];
type TrafficRow = Awaited<ReturnType<PostgresBudgetService["loadTrafficRows"]>>[number];

export class PostgresBudgetService implements BudgetService {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async get(query: BudgetQuery): Promise<BudgetResponse> {
    const asOf = this.clock().toISOString().slice(0, 10);
    const [program, baseRows, availableYears] = await Promise.all([
      this.loadProgram(query.year),
      this.loadBaseRows(query.year),
      this.loadAvailableYears()
    ]);
    const approvedBudget = money(
      program?.approvedBudgetAmount ?? null,
      program?.currency ?? null
    );

    if (baseRows.length === 0) {
      return budgetResponseSchema.parse({
        asOf,
        availableYears: ensureSelectedYear(availableYears, query.year),
        program: {
          id: program?.id ?? null,
          planningYear: query.year,
          approvedBudget
        },
        data: [],
        summary: summarizeBudget([], approvedBudget)
      });
    }

    const recommendationIds = baseRows.map((row) => row.recommendationId);
    const partialStructureIds = [
      ...new Set(baseRows.map((row) => row.partialStructureId))
    ];
    const bridgeIds = [...new Set(baseRows.map((row) => row.bridgeId))];
    const [findingRows, inspectionRows, trafficRows] = await Promise.all([
      this.loadFindingRows(recommendationIds),
      this.loadInspectionRows(partialStructureIds),
      this.loadTrafficRows(bridgeIds)
    ]);
    const findingsByRecommendation = groupBy(
      findingRows,
      (row) => row.recommendationId
    );
    const inspectionsByStructure = groupBy(
      inspectionRows,
      (row) => row.partialStructureId
    );
    const trafficByBridge = latestTrafficByBridge(trafficRows);
    const data = orderBudgetItems(
      baseRows.map((row) =>
        mapBudgetItem(
          row,
          findingsByRecommendation.get(row.recommendationId) ?? [],
          inspectionsByStructure.get(row.partialStructureId) ?? [],
          trafficByBridge.get(row.bridgeId)?.dailyTraffic ?? null,
          asOf
        )
      )
    );

    return budgetResponseSchema.parse({
      asOf,
      availableYears: ensureSelectedYear(availableYears, query.year),
      program: {
        id: program?.id ?? null,
        planningYear: query.year,
        approvedBudget
      },
      data,
      summary: summarizeBudget(data, approvedBudget)
    });
  }

  public async updateBudget(
    year: number,
    input: UpdateBudget
  ): Promise<BudgetResponse> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(budgetPrograms)
        .values({
          planningYear: year,
          approvedBudgetAmount: input.approvedBudget?.amount ?? null,
          currency: input.approvedBudget?.currency ?? null
        })
        .onConflictDoUpdate({
          target: budgetPrograms.planningYear,
          set: {
            approvedBudgetAmount: input.approvedBudget?.amount ?? null,
            currency: input.approvedBudget?.currency ?? null,
            updatedAt: new Date()
          }
        });
    });
    return this.get({ year });
  }

  public async updateMembership(
    year: number,
    interventionId: string,
    input: UpdateBudgetMembership
  ): Promise<UpdateBudgetMembershipResult> {
    const result = await this.database.transaction(async (transaction) => {
      const [intervention] = await transaction
        .select({
          id: plannedInterventions.id,
          year: plannedInterventions.plannedYear,
          status: plannedInterventions.status
        })
        .from(plannedInterventions)
        .where(eq(plannedInterventions.id, interventionId))
        .for("update")
        .limit(1);
      if (intervention === undefined) {
        return { outcome: "INTERVENTION_NOT_FOUND" as const, interventionId };
      }
      if (intervention.year !== year) {
        return {
          outcome: "INTERVENTION_YEAR_MISMATCH" as const,
          interventionId,
          interventionYear: intervention.year,
          requestedYear: year
        };
      }

      const [program] = await transaction
        .insert(budgetPrograms)
        .values({ planningYear: year })
        .onConflictDoUpdate({
          target: budgetPrograms.planningYear,
          set: { updatedAt: new Date() }
        })
        .returning({ id: budgetPrograms.id });
      if (program === undefined) {
        throw new Error("Budget program upsert returned no record.");
      }

      if (input.included) {
        await transaction
          .insert(budgetProgramInterventions)
          .values({
            budgetProgramId: program.id,
            interventionId,
            planningYear: year
          })
          .onConflictDoNothing();
        // Only advance a still-unbudgeted intervention; one already past
        // BUDGETED (e.g. TENDER_PREPARATION) keeps its further-along status.
        if (intervention.status === "PLANNED") {
          await transaction
            .update(plannedInterventions)
            .set({ status: "BUDGETED", updatedAt: new Date() })
            .where(eq(plannedInterventions.id, interventionId));
        }
      } else {
        await transaction
          .delete(budgetProgramInterventions)
          .where(
            and(
              eq(budgetProgramInterventions.budgetProgramId, program.id),
              eq(budgetProgramInterventions.interventionId, interventionId)
            )
          );
        // Symmetric guard: only revert an intervention still sitting at
        // BUDGETED; leave later lifecycle stages untouched.
        if (intervention.status === "BUDGETED") {
          await transaction
            .update(plannedInterventions)
            .set({ status: "PLANNED", updatedAt: new Date() })
            .where(eq(plannedInterventions.id, interventionId));
        }
      }
      return { outcome: "UPDATED" as const };
    });

    return result.outcome === "UPDATED"
      ? { outcome: "UPDATED", response: await this.get({ year }) }
      : result;
  }

  private loadProgram(year: number) {
    return this.database.query.budgetPrograms.findFirst({
      where: eq(budgetPrograms.planningYear, year)
    });
  }

  private loadBaseRows(year: number) {
    return this.database
      .select({
        bridgeId: plannedInterventions.bridgeId,
        bridgeExternalStructureNumber: bridges.externalStructureNumber,
        bridgeName: bridges.name,
        bridgeRoad: bridges.road,
        partialStructureId: plannedInterventions.partialStructureId,
        recommendationId: plannedInterventions.recommendationId,
        recommendationUrgency: recommendations.urgency,
        recommendationTargetYear: recommendations.targetYear,
        sourceEstimatedCost: recommendations.sourceEstimatedCost,
        sourceEstimatedCostCurrency: recommendations.sourceEstimatedCostCurrency,
        interventionId: plannedInterventions.id,
        interventionWorkType: plannedInterventions.workType,
        interventionPlannedYear: plannedInterventions.plannedYear,
        interventionStatus: plannedInterventions.status,
        interventionEstimatedCost: plannedInterventions.estimatedCost,
        interventionEstimatedCostCurrency: plannedInterventions.estimatedCostCurrency,
        interventionEstimatedCostSource: plannedInterventions.estimatedCostSource,
        interventionEstimatedCostStatus: plannedInterventions.estimatedCostStatus,
        membershipInterventionId: budgetProgramInterventions.interventionId
      })
      .from(plannedInterventions)
      .innerJoin(recommendations, eq(recommendations.id, plannedInterventions.recommendationId))
      .innerJoin(bridges, eq(bridges.id, plannedInterventions.bridgeId))
      .leftJoin(
        budgetProgramInterventions,
        and(
          eq(budgetProgramInterventions.interventionId, plannedInterventions.id),
          eq(budgetProgramInterventions.planningYear, year)
        )
      )
      .where(eq(plannedInterventions.plannedYear, year));
  }

  private loadFindingRows(recommendationIds: string[]) {
    return this.database
      .select({
        recommendationId: recommendationFindings.recommendationId,
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
        dailyTraffic: trafficObservations.dailyTraffic,
        observationYear: trafficObservations.observationYear
      })
      .from(trafficObservations)
      .where(inArray(trafficObservations.bridgeId, bridgeIds))
      .orderBy(desc(trafficObservations.observationYear), desc(trafficObservations.id));
  }

  private async loadAvailableYears(): Promise<number[]> {
    const [interventionYears, programYears] = await Promise.all([
      this.database
        .selectDistinct({ year: plannedInterventions.plannedYear })
        .from(plannedInterventions)
        .orderBy(asc(plannedInterventions.plannedYear)),
      this.database
        .selectDistinct({ year: budgetPrograms.planningYear })
        .from(budgetPrograms)
        .orderBy(asc(budgetPrograms.planningYear))
    ]);
    return [...new Set([...interventionYears, ...programYears].map((row) => row.year))].sort();
  }
}

function mapBudgetItem(
  row: BaseRow,
  findingRows: readonly FindingRow[],
  inspectionRows: readonly InspectionRow[],
  dailyTraffic: number | null,
  asOf: string
): BudgetItem {
  const activeFindings = findingRows.filter(
    (finding) => finding.status === "OPEN" || finding.status === "MONITORING"
  );
  const datedInspections = inspectionRows.filter(
    (inspection): inspection is InspectionRow & { inspectedOn: string } =>
      inspection.inspectedOn !== null
  );
  const scored = datedInspections.filter(
    (inspection): inspection is typeof inspection & { conditionScore: string } =>
      inspection.conditionScore !== null
  );
  const conditionDelta =
    scored[0] === undefined || scored[1] === undefined
      ? null
      : (Number(scored[0].conditionScore) - Number(scored[1].conditionScore)).toFixed(1);
  const sourceDate =
    findingRows
      .map((finding) => finding.inspectedOn)
      .filter((date): date is string => date !== null)
      .sort()[0] ?? null;
  const interventionEstimate = money(
    row.interventionEstimatedCost,
    row.interventionEstimatedCostCurrency
  );
  const sourceEstimate = money(
    row.sourceEstimatedCost,
    row.sourceEstimatedCostCurrency
  );
  const estimate =
    interventionEstimate === null ||
    row.interventionEstimatedCostSource === null ||
    row.interventionEstimatedCostStatus === null
      ? sourceEstimate === null
        ? null
        : { ...sourceEstimate, source: "SOURCE_DOCUMENT" as const, status: null }
      : {
          ...interventionEstimate,
          source: row.interventionEstimatedCostSource,
          status: row.interventionEstimatedCostStatus
        };

  return {
    bridge: {
      id: row.bridgeId,
      externalStructureNumber: row.bridgeExternalStructureNumber,
      name: row.bridgeName,
      road: row.bridgeRoad
    },
    intervention: {
      id: row.interventionId,
      workType: row.interventionWorkType,
      plannedYear: row.interventionPlannedYear,
      status: row.interventionStatus,
      estimatedCost: interventionEstimate,
      estimatedCostSource: row.interventionEstimatedCostSource,
      estimatedCostStatus: row.interventionEstimatedCostStatus
    },
    sourceRecommendation: {
      id: row.recommendationId,
      urgency: row.recommendationUrgency,
      targetYear: row.recommendationTargetYear,
      sourceEstimatedCost: sourceEstimate
    },
    estimate,
    estimateRequired: estimate === null,
    included: row.membershipInterventionId !== null,
    priority: deriveMaintenancePriority({
      asOf,
      conditionDelta,
      dailyTraffic,
      inspectionStatus: deriveInspectionDueStatus(datedInspections[0], asOf),
      maximumDurability: maximum(activeFindings, "durabilityRating"),
      maximumStability: maximum(activeFindings, "stabilityRating"),
      maximumTrafficSafety: maximum(activeFindings, "trafficSafetyRating"),
      recommendationSourceDate: sourceDate,
      urgency: row.recommendationUrgency
    })
  };
}

function groupBy<Row>(
  rows: readonly Row[],
  key: (row: Row) => string
): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const value = key(row);
    grouped.set(value, [...(grouped.get(value) ?? []), row]);
  }
  return grouped;
}

function latestTrafficByBridge(rows: readonly TrafficRow[]): Map<string, TrafficRow> {
  const latest = new Map<string, TrafficRow>();
  for (const row of rows) {
    if (!latest.has(row.bridgeId)) latest.set(row.bridgeId, row);
  }
  return latest;
}

function maximum(
  rows: readonly FindingRow[],
  key: "durabilityRating" | "stabilityRating" | "trafficSafetyRating"
): number | null {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.max(...values);
}

function money(
  amount: string | null,
  currency: string | null
): { amount: string; currency: string } | null {
  return amount === null || currency === null ? null : { amount, currency };
}

function ensureSelectedYear(years: readonly number[], selected: number): number[] {
  return [...new Set([...years, selected])].sort((left, right) => left - right);
}
