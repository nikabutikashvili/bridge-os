import {
  budgetMembershipParamsSchema,
  budgetQuerySchema,
  budgetYearParamsSchema,
  updateBudgetMembershipSchema,
  updateBudgetSchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import type { BudgetService } from "./budget-service.js";

export function registerBudgetRoutes(
  app: FastifyInstance,
  service: BudgetService
): void {
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
