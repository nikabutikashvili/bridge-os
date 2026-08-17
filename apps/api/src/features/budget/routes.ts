import {
  autoFillBudgetScenarioSchema,
  budgetMembershipParamsSchema,
  budgetQuerySchema,
  budgetScenarioAssignmentParamsSchema,
  budgetScenarioCompareQuerySchema,
  budgetScenarioParamsSchema,
  budgetYearParamsSchema,
  createBudgetScenarioSchema,
  updateBudgetMembershipSchema,
  updateBudgetScenarioAssignmentSchema,
  updateBudgetScenarioSchema,
  updateBudgetSchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import type { BudgetScenarioService } from "./budget-scenario-service.js";
import type { BudgetService } from "./budget-service.js";

export function registerBudgetRoutes(
  app: FastifyInstance,
  service: BudgetService,
  scenarioService: BudgetScenarioService
): void {
  app.get("/api/v1/budget/scenarios", async () => {
    return scenarioService.list();
  });

  app.post("/api/v1/budget/scenarios", async (request) => {
    return scenarioService.create(createBudgetScenarioSchema.parse(request.body));
  });

  app.get("/api/v1/budget/scenarios/compare", async (request) => {
    const query = budgetScenarioCompareQuerySchema.parse(request.query);
    const result = await scenarioService.compare(query.left, query.right);
    if (result.outcome === "NOT_FOUND") {
      throw notFound(result.scenarioId);
    }
    return result.response;
  });

  app.get("/api/v1/budget/scenarios/:scenarioId", async (request) => {
    const { scenarioId } = budgetScenarioParamsSchema.parse(request.params);
    const response = await scenarioService.get(scenarioId);
    if (response === null) {
      throw notFound(scenarioId);
    }
    return response;
  });

  app.patch("/api/v1/budget/scenarios/:scenarioId", async (request) => {
    const { scenarioId } = budgetScenarioParamsSchema.parse(request.params);
    const result = await scenarioService.update(
      scenarioId,
      updateBudgetScenarioSchema.parse(request.body)
    );
    if (result.outcome === "NOT_FOUND") {
      throw notFound(scenarioId);
    }
    if (result.outcome === "YEAR_OUT_OF_HORIZON") {
      throw yearOutOfHorizon(result.year, result.years);
    }
    return result.response;
  });

  app.delete("/api/v1/budget/scenarios/:scenarioId", async (request, reply) => {
    const { scenarioId } = budgetScenarioParamsSchema.parse(request.params);
    const result = await scenarioService.remove(scenarioId);
    if (result.outcome === "NOT_FOUND") {
      throw notFound(scenarioId);
    }
    return reply.status(204).send();
  });

  app.post("/api/v1/budget/scenarios/:scenarioId/auto-fill", async (request) => {
    const { scenarioId } = budgetScenarioParamsSchema.parse(request.params);
    const result = await scenarioService.autoFill(
      scenarioId,
      autoFillBudgetScenarioSchema.parse(request.body ?? {})
    );
    if (result.outcome === "NOT_FOUND") {
      throw notFound(scenarioId);
    }
    return result.response;
  });

  app.post("/api/v1/budget/scenarios/:scenarioId/adopt", async (request) => {
    const { scenarioId } = budgetScenarioParamsSchema.parse(request.params);
    const result = await scenarioService.adopt(scenarioId);
    if (result.outcome === "NOT_FOUND") {
      throw notFound(scenarioId);
    }
    return result.response;
  });

  app.put(
    "/api/v1/budget/scenarios/:scenarioId/assignments/:interventionId",
    async (request) => {
      const { scenarioId, interventionId } =
        budgetScenarioAssignmentParamsSchema.parse(request.params);
      const result = await scenarioService.updateAssignment(
        scenarioId,
        interventionId,
        updateBudgetScenarioAssignmentSchema.parse(request.body)
      );
      if (result.outcome === "NOT_FOUND") {
        throw notFound(scenarioId);
      }
      if (result.outcome === "INTERVENTION_NOT_FOUND") {
        throw new HttpError({
          code: "INTERVENTION_NOT_FOUND",
          details: { interventionId },
          message: "Planned intervention not found.",
          statusCode: 404
        });
      }
      if (result.outcome === "YEAR_OUT_OF_HORIZON") {
        throw yearOutOfHorizon(result.assignedYear, result.years);
      }
      return result.response;
    }
  );

  app.get("/api/v1/budget", async (request) => {
    return service.get(budgetQuerySchema.parse(request.query));
  });

  app.put("/api/v1/budget/:year", async (request) => {
    const { year } = budgetYearParamsSchema.parse(request.params);
    return service.updateBudget(year, updateBudgetSchema.parse(request.body));
  });

  app.put(
    "/api/v1/budget/:year/interventions/:interventionId",
    async (request) => {
      const { year, interventionId } = budgetMembershipParamsSchema.parse(
        request.params
      );
      const result = await service.updateMembership(
        year,
        interventionId,
        updateBudgetMembershipSchema.parse(request.body)
      );
      if (result.outcome === "INTERVENTION_NOT_FOUND") {
        throw new HttpError({
          code: "INTERVENTION_NOT_FOUND",
          details: { interventionId },
          message: "Planned intervention not found.",
          statusCode: 404
        });
      }
      if (result.outcome === "INTERVENTION_YEAR_MISMATCH") {
        throw new HttpError({
          code: "INTERVENTION_YEAR_MISMATCH",
          details: {
            interventionId,
            interventionYear: result.interventionYear,
            requestedYear: result.requestedYear
          },
          message: "Intervention belongs to a different planning year.",
          statusCode: 409
        });
      }
      return result.response;
    }
  );
}

function notFound(scenarioId: string): HttpError {
  return new HttpError({
    code: "SCENARIO_NOT_FOUND",
    details: { scenarioId },
    message: "Budget scenario not found.",
    statusCode: 404
  });
}

function yearOutOfHorizon(year: number, years: readonly number[]): HttpError {
  return new HttpError({
    code: "YEAR_OUT_OF_HORIZON",
    details: { year, years },
    message: "Year is outside the scenario horizon.",
    statusCode: 409
  });
}
