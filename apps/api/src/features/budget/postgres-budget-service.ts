import {
  budgetResponseSchema,
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

import {
  groupBy,
  latestTrafficByBridge,
  mapBudgetItem,
  moneyPair
} from "./budget-item-map.js";
import type {
  BudgetService,
  UpdateBudgetMembershipResult
} from "./budget-service.js";
import { orderBudgetItems, summarizeBudget } from "./calculations.js";

type Clock = () => Date;

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
    const approvedBudget = moneyPair(
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

function ensureSelectedYear(years: readonly number[], selected: number): number[] {
  return [...new Set([...years, selected])].sort((left, right) => left - right);
}
