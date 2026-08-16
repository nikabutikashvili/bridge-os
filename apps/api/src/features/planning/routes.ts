import {
  createPlannedInterventionSchema,
  planningQuerySchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import type { PlanningService } from "./planning-service.js";

export function registerPlanningRoutes(
  app: FastifyInstance,
  service: PlanningService
): void {
  app.get("/api/v1/planning", async (request) => {
    const query = planningQuerySchema.parse(request.query);
    return service.list(query);
  });

  app.post("/api/v1/planning/interventions", async (request, reply) => {
    const input = createPlannedInterventionSchema.parse(request.body);
    const result = await service.createFromRecommendation(input);

    switch (result.outcome) {
      case "CREATED":
        return reply.status(201).send(result.response);
      case "RECOMMENDATION_NOT_FOUND":
        throw new HttpError({
          code: "RECOMMENDATION_NOT_FOUND",
          details: { recommendationId: result.recommendationId },
          message: "Recommendation not found.",
          statusCode: 404
        });
      case "RECOMMENDATION_NOT_ACTIONABLE":
        throw new HttpError({
          code: "RECOMMENDATION_NOT_ACTIONABLE",
          details: { recommendationId: result.recommendationId },
          message: "Completed or cancelled recommendations cannot be planned.",
          statusCode: 409
        });
      case "INTERVENTION_ALREADY_EXISTS":
        throw new HttpError({
          code: "INTERVENTION_ALREADY_EXISTS",
          details: {
            interventionId: result.interventionId,
            recommendationId: result.recommendationId
          },
          message: "A planned intervention already exists for this recommendation.",
          statusCode: 409
        });
    }
  });
}
