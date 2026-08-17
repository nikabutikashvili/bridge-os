import {
  BUDGET_SCENARIO_HORIZON_YEARS,
  budgetScenarioListResponseSchema,
  budgetScenarioResponseSchema,
  type AutoFillBudgetScenario,
  type BudgetScenarioItem,
  type BudgetScenarioListResponse,
  type BudgetScenarioResponse,
  type CreateBudgetScenario,
  type UpdateBudgetScenario,
  type UpdateBudgetScenarioAssignment
} from "@bridge-os/contracts";
import {
  bridges,
  budgetProgramInterventions,
  budgetPrograms,
  budgetScenarioAssignments,
  budgetScenarioEnvelopes,
  budgetScenarios,
  environmentalMetrics,
  findings,
  inspections,
  networkMetrics,
  plannedInterventions,
  recommendationFindings,
  recommendations,
  trafficObservations,
  type BridgeDatabase
} from "@bridge-os/db";
import { desc, eq, inArray } from "drizzle-orm";

import {
  groupBy,
  latestTrafficByBridge,
  mapBudgetItem
} from "./budget-item-map.js";
import type {
  BudgetScenarioAssignmentResult,
  BudgetScenarioCompareResult,
  BudgetScenarioMutationResult,
  BudgetScenarioService,
  BudgetScenarioUpdateResult
} from "./budget-scenario-service.js";
import { orderBudgetItems, toMinorUnits } from "./calculations.js";
import {
  autoFillScenario,
  horizonYearList,
  listScenarioTotals,
  summarizeScenarioYears,
  summarizeUnassigned,
  yearInHorizon
} from "./scenario-calculations.js";

type Clock = () => Date;

export class PostgresBudgetScenarioService implements BudgetScenarioService {
  public constructor(
    private readonly database: BridgeDatabase,
    private readonly clock: Clock = () => new Date()
  ) {}

  public async list(): Promise<BudgetScenarioListResponse> {
    const asOf = this.currentDate();
    const scenarios = await this.database.query.budgetScenarios.findMany({
      orderBy: (table, { desc: descending }) => descending(table.updatedAt)
    });
    if (scenarios.length === 0) {
      return budgetScenarioListResponseSchema.parse({ asOf, data: [] });
    }

    const scenarioIds = scenarios.map((scenario) => scenario.id);
    const [envelopeRows, assignmentRows, items] = await Promise.all([
      this.database
        .select()
        .from(budgetScenarioEnvelopes)
        .where(inArray(budgetScenarioEnvelopes.scenarioId, scenarioIds)),
      this.database
        .select()
        .from(budgetScenarioAssignments)
        .where(inArray(budgetScenarioAssignments.scenarioId, scenarioIds)),
      this.loadScenarioItems(asOf)
    ]);

    return budgetScenarioListResponseSchema.parse({
      asOf,
      data: scenarios.map((scenario) => {
        const years = horizonYearList(scenario.horizonStartYear, scenario.horizonYears);
        const envelopes = years.map((year) => {
          const row = envelopeRows.find(
            (envelope) =>
              envelope.scenarioId === scenario.id && envelope.planningYear === year
          );
          return {
            year,
            approvedBudget: money(row?.approvedBudgetAmount ?? null, row?.currency ?? null)
          };
        });
        const scenarioItems = items.map((item) => {
          const assignment = assignmentRows.find(
            (row) =>
              row.scenarioId === scenario.id &&
              row.interventionId === item.intervention.id
          );
          return withAssignment(item, assignment, years);
        });
        const totals = listScenarioTotals(
          scenarioItems,
          envelopes,
          scenario.currency
        );
        return {
          ...serializeScenario(scenario, years),
          ...totals
        };
      })
    });
  }

  public async get(scenarioId: string): Promise<BudgetScenarioResponse | null> {
    const scenario = await this.loadScenario(scenarioId);
    if (scenario === undefined) {
      return null;
    }
    return this.buildResponse(scenario);
  }

  public async create(input: CreateBudgetScenario): Promise<BudgetScenarioResponse> {
    const years = horizonYearList(input.horizonStartYear, BUDGET_SCENARIO_HORIZON_YEARS);
    const now = this.clock();
    const scenarioId = await this.database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(budgetScenarios)
        .values({
          name: input.name,
          horizonStartYear: input.horizonStartYear,
          horizonYears: BUDGET_SCENARIO_HORIZON_YEARS,
          currency: input.annualEnvelope?.currency ?? "EUR",
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: budgetScenarios.id });
      if (created === undefined) {
        throw new Error("Budget scenario insert returned no record.");
      }

      await transaction.insert(budgetScenarioEnvelopes).values(
        years.map((year) => ({
          scenarioId: created.id,
          planningYear: year,
          approvedBudgetAmount: input.annualEnvelope?.amount ?? null,
          currency: input.annualEnvelope?.currency ?? null,
          createdAt: now,
          updatedAt: now
        }))
      );

      const interventions = await transaction
        .select({
          id: plannedInterventions.id,
          plannedYear: plannedInterventions.plannedYear
        })
        .from(plannedInterventions);
      if (interventions.length > 0) {
        await transaction.insert(budgetScenarioAssignments).values(
          interventions.map((intervention) => ({
            scenarioId: created.id,
            interventionId: intervention.id,
            assignedYear: yearInHorizon(intervention.plannedYear, years)
              ? intervention.plannedYear
              : null,
            assignmentSource: "SEEDED" as const,
            createdAt: now,
            updatedAt: now
          }))
        );
      }
      return created.id;
    });
    const created = await this.get(scenarioId);
    if (created === null) {
      throw new Error("Created budget scenario could not be loaded.");
    }
    return created;
  }

  public async update(
    scenarioId: string,
    input: UpdateBudgetScenario
  ): Promise<BudgetScenarioUpdateResult> {
    const scenario = await this.loadScenario(scenarioId);
    if (scenario === undefined) {
      return { outcome: "NOT_FOUND", scenarioId };
    }
    const years = horizonYearList(scenario.horizonStartYear, scenario.horizonYears);
    if (input.envelopes !== undefined) {
      const invalid = input.envelopes.find((envelope) => !years.includes(envelope.year));
      if (invalid !== undefined) {
        return {
          outcome: "YEAR_OUT_OF_HORIZON",
          year: invalid.year,
          years
        };
      }
    }

    const now = this.clock();
    await this.database.transaction(async (transaction) => {
      if (input.name !== undefined) {
        await transaction
          .update(budgetScenarios)
          .set({
            name: input.name,
            status: "DRAFT",
            adoptedAt: null,
            updatedAt: now
          })
          .where(eq(budgetScenarios.id, scenarioId));
      }
      if (input.envelopes !== undefined) {
        for (const envelope of input.envelopes) {
          await transaction
            .insert(budgetScenarioEnvelopes)
            .values({
              scenarioId,
              planningYear: envelope.year,
              approvedBudgetAmount: envelope.approvedBudget?.amount ?? null,
              currency: envelope.approvedBudget?.currency ?? null,
              createdAt: now,
              updatedAt: now
            })
            .onConflictDoUpdate({
              target: [
                budgetScenarioEnvelopes.scenarioId,
                budgetScenarioEnvelopes.planningYear
              ],
              set: {
                approvedBudgetAmount: envelope.approvedBudget?.amount ?? null,
                currency: envelope.approvedBudget?.currency ?? null,
                updatedAt: now
              }
            });
        }
        await transaction
          .update(budgetScenarios)
          .set({ status: "DRAFT", adoptedAt: null, updatedAt: now })
          .where(eq(budgetScenarios.id, scenarioId));
      }
    });
    return { outcome: "UPDATED", response: await this.requireResponse(scenarioId) };
  }

  public async remove(
    scenarioId: string
  ): Promise<{ readonly outcome: "DELETED" | "NOT_FOUND" }> {
    const deleted = await this.database
      .delete(budgetScenarios)
      .where(eq(budgetScenarios.id, scenarioId))
      .returning({ id: budgetScenarios.id });
    return deleted.length === 0
      ? { outcome: "NOT_FOUND" }
      : { outcome: "DELETED" };
  }

  public async updateAssignment(
    scenarioId: string,
    interventionId: string,
    input: UpdateBudgetScenarioAssignment
  ): Promise<BudgetScenarioAssignmentResult> {
    const scenario = await this.loadScenario(scenarioId);
    if (scenario === undefined) {
      return { outcome: "NOT_FOUND", scenarioId };
    }
    const years = horizonYearList(scenario.horizonStartYear, scenario.horizonYears);
    if (input.assignedYear !== null && !years.includes(input.assignedYear)) {
      return {
        outcome: "YEAR_OUT_OF_HORIZON",
        assignedYear: input.assignedYear,
        years
      };
    }

    const now = this.clock();
    const result = await this.database.transaction(async (transaction) => {
      const [intervention] = await transaction
        .select({ id: plannedInterventions.id })
        .from(plannedInterventions)
        .where(eq(plannedInterventions.id, interventionId))
        .limit(1);
      if (intervention === undefined) {
        return { outcome: "INTERVENTION_NOT_FOUND" as const };
      }
      await transaction
        .insert(budgetScenarioAssignments)
        .values({
          scenarioId,
          interventionId,
          assignedYear: input.assignedYear,
          assignmentSource: "USER_OVERRIDE",
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [
            budgetScenarioAssignments.scenarioId,
            budgetScenarioAssignments.interventionId
          ],
          set: {
            assignedYear: input.assignedYear,
            assignmentSource: "USER_OVERRIDE",
            updatedAt: now
          }
        });
      await transaction
        .update(budgetScenarios)
        .set({ status: "DRAFT", adoptedAt: null, updatedAt: now })
        .where(eq(budgetScenarios.id, scenarioId));
      return { outcome: "UPDATED" as const };
    });

    return result.outcome === "INTERVENTION_NOT_FOUND"
      ? { outcome: "INTERVENTION_NOT_FOUND", interventionId }
      : { outcome: "UPDATED", response: await this.requireResponse(scenarioId) };
  }

  public async autoFill(
    scenarioId: string,
    input: AutoFillBudgetScenario
  ): Promise<BudgetScenarioMutationResult> {
    const current = await this.get(scenarioId);
    if (current === null) {
      return { outcome: "NOT_FOUND", scenarioId };
    }

    const assignments = autoFillScenario({
      candidates: current.data.map((item) => ({
        interventionId: item.intervention.id,
        workType: item.intervention.workType,
        plannedYear: item.intervention.plannedYear,
        priorityLevel: item.priority.level,
        estimateMinorUnits:
          item.estimate === null ? null : toMinorUnits(item.estimate.amount),
        assignedYear: item.assignedYear,
        assignmentSource: item.assignmentSource
      })),
      years: current.scenario.years,
      envelopes: current.envelopes.map((envelope) => ({
        year: envelope.year,
        budgetMinorUnits:
          envelope.approvedBudget === null
            ? null
            : toMinorUnits(envelope.approvedBudget.amount)
      })),
      preserveOverrides: input.preserveOverrides
    });

    const now = this.clock();
    await this.database.transaction(async (transaction) => {
      for (const assignment of assignments) {
        await transaction
          .insert(budgetScenarioAssignments)
          .values({
            scenarioId,
            interventionId: assignment.interventionId,
            assignedYear: assignment.assignedYear,
            assignmentSource: assignment.assignmentSource,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: [
              budgetScenarioAssignments.scenarioId,
              budgetScenarioAssignments.interventionId
            ],
            set: {
              assignedYear: assignment.assignedYear,
              assignmentSource: assignment.assignmentSource,
              updatedAt: now
            }
          });
      }
      await transaction
        .update(budgetScenarios)
        .set({ status: "DRAFT", adoptedAt: null, updatedAt: now })
        .where(eq(budgetScenarios.id, scenarioId));
    });
    return { outcome: "UPDATED", response: await this.requireResponse(scenarioId) };
  }

  public async adopt(scenarioId: string): Promise<BudgetScenarioMutationResult> {
    const current = await this.get(scenarioId);
    if (current === null) {
      return { outcome: "NOT_FOUND", scenarioId };
    }

    const now = this.clock();
    await this.database.transaction(async (transaction) => {
      const interventions = await transaction
        .select({
          id: plannedInterventions.id,
          plannedYear: plannedInterventions.plannedYear,
          status: plannedInterventions.status
        })
        .from(plannedInterventions)
        .for("update");
      const byId = new Map(interventions.map((row) => [row.id, row] as const));

      for (const item of current.data) {
        const intervention = byId.get(item.intervention.id);
        if (intervention === undefined) {
          continue;
        }
        await transaction
          .delete(budgetProgramInterventions)
          .where(eq(budgetProgramInterventions.interventionId, intervention.id));

        const assignedYear = item.assignedYear;
        if (assignedYear !== null && assignedYear !== intervention.plannedYear) {
          await transaction
            .update(plannedInterventions)
            .set({ plannedYear: assignedYear, updatedAt: now })
            .where(eq(plannedInterventions.id, intervention.id));
        }

        if (assignedYear === null) {
          if (intervention.status === "BUDGETED") {
            await transaction
              .update(plannedInterventions)
              .set({ status: "PLANNED", updatedAt: now })
              .where(eq(plannedInterventions.id, intervention.id));
          }
          continue;
        }

        const [program] = await transaction
          .insert(budgetPrograms)
          .values({ planningYear: assignedYear })
          .onConflictDoUpdate({
            target: budgetPrograms.planningYear,
            set: { updatedAt: now }
          })
          .returning({ id: budgetPrograms.id });
        if (program === undefined) {
          throw new Error("Budget program upsert returned no record.");
        }
        await transaction
          .insert(budgetProgramInterventions)
          .values({
            budgetProgramId: program.id,
            interventionId: intervention.id,
            planningYear: assignedYear
          })
          .onConflictDoNothing();
        if (intervention.status === "PLANNED") {
          await transaction
            .update(plannedInterventions)
            .set({ status: "BUDGETED", updatedAt: now })
            .where(eq(plannedInterventions.id, intervention.id));
        }
      }

      for (const envelope of current.envelopes) {
        await transaction
          .insert(budgetPrograms)
          .values({
            planningYear: envelope.year,
            approvedBudgetAmount: envelope.approvedBudget?.amount ?? null,
            currency: envelope.approvedBudget?.currency ?? null,
            createdAt: now,
            updatedAt: now
          })
          .onConflictDoUpdate({
            target: budgetPrograms.planningYear,
            set: {
              approvedBudgetAmount: envelope.approvedBudget?.amount ?? null,
              currency: envelope.approvedBudget?.currency ?? null,
              updatedAt: now
            }
          });
      }

      await transaction
        .update(budgetScenarios)
        .set({ status: "ADOPTED", adoptedAt: now, updatedAt: now })
        .where(eq(budgetScenarios.id, scenarioId));
    });

    return { outcome: "UPDATED", response: await this.requireResponse(scenarioId) };
  }

  public async compare(
    leftId: string,
    rightId: string
  ): Promise<BudgetScenarioCompareResult> {
    const [left, right] = await Promise.all([this.get(leftId), this.get(rightId)]);
    if (left === null) {
      return { outcome: "NOT_FOUND", scenarioId: leftId };
    }
    if (right === null) {
      return { outcome: "NOT_FOUND", scenarioId: rightId };
    }
    return {
      outcome: "COMPARED",
      response: { asOf: left.asOf, left, right }
    };
  }

  private async buildResponse(
    scenario: typeof budgetScenarios.$inferSelect
  ): Promise<BudgetScenarioResponse> {
    const asOf = this.currentDate();
    const years = horizonYearList(scenario.horizonStartYear, scenario.horizonYears);
    const [envelopeRows, assignmentRows] = await Promise.all([
      this.database
        .select()
        .from(budgetScenarioEnvelopes)
        .where(eq(budgetScenarioEnvelopes.scenarioId, scenario.id)),
      this.database
        .select()
        .from(budgetScenarioAssignments)
        .where(eq(budgetScenarioAssignments.scenarioId, scenario.id))
    ]);
    const assignmentByIntervention = new Map(
      assignmentRows.map((row) => [row.interventionId, row] as const)
    );
    const mapped = await this.loadScenarioItems(asOf);
    const data = orderBudgetItems(mapped).map((item) =>
      withAssignment(item, assignmentByIntervention.get(item.intervention.id), years)
    );
    const envelopes = years.map((year) => {
      const row = envelopeRows.find((envelope) => envelope.planningYear === year);
      return {
        year,
        approvedBudget: money(row?.approvedBudgetAmount ?? null, row?.currency ?? null)
      };
    });
    const envelopeMap = new Map(
      envelopes.map((envelope) => [envelope.year, envelope.approvedBudget] as const)
    );

    return budgetScenarioResponseSchema.parse({
      asOf,
      scenario: serializeScenario(scenario, years),
      envelopes,
      yearSummaries: summarizeScenarioYears(data, years, envelopeMap),
      unassigned: summarizeUnassigned(data, scenario.currency),
      data
    });
  }

  private async loadScenarioItems(asOf: string) {
    const baseRows = await this.loadBaseRows();
    if (baseRows.length === 0) {
      return [];
    }
    const recommendationIds = baseRows.map((row) => row.recommendationId);
    const partialStructureIds = [
      ...new Set(baseRows.map((row) => row.partialStructureId))
    ];
    const bridgeIds = [...new Set(baseRows.map((row) => row.bridgeId))];
    const [findingRows, inspectionRows, trafficRows, environmentRows, networkRows] =
      await Promise.all([
      this.loadFindingRows(recommendationIds),
      this.loadInspectionRows(partialStructureIds),
      this.loadTrafficRows(bridgeIds),
      this.loadEnvironmentRows(bridgeIds),
      this.loadNetworkRows(bridgeIds)
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
    const environmentByBridge = latestTrafficByBridge(environmentRows);
    const networkByBridge = latestTrafficByBridge(networkRows);
    return baseRows.map((row) =>
      mapBudgetItem(
        row,
        findingsByRecommendation.get(row.recommendationId) ?? [],
        inspectionsByStructure.get(row.partialStructureId) ?? [],
        trafficByBridge.get(row.bridgeId) ?? null,
        environmentByBridge.get(row.bridgeId) ?? null,
        networkByBridge.get(row.bridgeId) ?? null,
        asOf
      )
    );
  }

  private loadScenario(scenarioId: string) {
    return this.database.query.budgetScenarios.findFirst({
      where: eq(budgetScenarios.id, scenarioId)
    });
  }

  private async requireResponse(scenarioId: string): Promise<BudgetScenarioResponse> {
    const response = await this.get(scenarioId);
    if (response === null) {
      throw new Error("Budget scenario disappeared after mutation.");
    }
    return response;
  }

  private loadBaseRows() {
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
      .innerJoin(
        recommendations,
        eq(recommendations.id, plannedInterventions.recommendationId)
      )
      .innerJoin(bridges, eq(bridges.id, plannedInterventions.bridgeId))
      .leftJoin(
        budgetProgramInterventions,
        eq(budgetProgramInterventions.interventionId, plannedInterventions.id)
      );
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
        heavyVehicleDaily: trafficObservations.heavyVehicleDaily,
        truckSharePercent: trafficObservations.truckSharePercent,
        observationYear: trafficObservations.observationYear
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
        freezeThawDays: environmentalMetrics.freezeThawDays,
        heavyRainDays20: environmentalMetrics.heavyRainDays20,
        deicingDays: environmentalMetrics.deicingDays,
        observationYear: environmentalMetrics.observationYear
      })
      .from(environmentalMetrics)
      .where(inArray(environmentalMetrics.bridgeId, bridgeIds))
      .orderBy(desc(environmentalMetrics.observationYear), desc(environmentalMetrics.id));
  }

  private loadNetworkRows(bridgeIds: string[]) {
    return this.database
      .select({
        bridgeId: networkMetrics.bridgeId,
        additionalDistanceKm: networkMetrics.additionalDistanceKm,
        alternativeCrossingCount: networkMetrics.alternativeCrossingCount,
        roadClass: networkMetrics.roadClass
      })
      .from(networkMetrics)
      .where(inArray(networkMetrics.bridgeId, bridgeIds));
  }

  private currentDate(): string {
    return this.clock().toISOString().slice(0, 10);
  }
}

function withAssignment(
  item: ReturnType<typeof mapBudgetItem>,
  assignment:
    | {
        readonly assignedYear: number | null;
        readonly assignmentSource: BudgetScenarioItem["assignmentSource"];
      }
    | undefined,
  years: readonly number[]
): BudgetScenarioItem {
  const assignedYear =
    assignment !== undefined && yearInHorizon(assignment.assignedYear, years)
      ? assignment.assignedYear
      : assignment?.assignedYear === null
        ? null
        : yearInHorizon(item.intervention.plannedYear, years)
          ? item.intervention.plannedYear
        : null;
  return {
    ...stripIncluded(item),
    assignedYear,
    assignmentSource: assignment?.assignmentSource ?? (assignedYear === null ? null : "SEEDED"),
    liveIncluded: item.included
  };
}

function stripIncluded(
  item: ReturnType<typeof mapBudgetItem> | BudgetScenarioItem
): Omit<BudgetScenarioItem, "assignedYear" | "assignmentSource" | "liveIncluded"> {
  return {
    bridge: item.bridge,
    intervention: item.intervention,
    sourceRecommendation: item.sourceRecommendation,
    estimate: item.estimate,
    estimateRequired: item.estimateRequired,
    networkCriticality: item.networkCriticality,
    priority: item.priority
  };
}

function serializeScenario(
  scenario: typeof budgetScenarios.$inferSelect,
  years: readonly number[]
): BudgetScenarioResponse["scenario"] {
  return {
    id: scenario.id,
    name: scenario.name,
    status: scenario.status,
    horizonStartYear: scenario.horizonStartYear,
    horizonYears: scenario.horizonYears,
    years: [...years],
    currency: scenario.currency,
    adoptedAt: scenario.adoptedAt?.toISOString() ?? null,
    createdAt: scenario.createdAt.toISOString(),
    updatedAt: scenario.updatedAt.toISOString()
  };
}

function money(
  amount: string | null,
  currency: string | null
): { amount: string; currency: string } | null {
  return amount === null || currency === null ? null : { amount, currency };
}
