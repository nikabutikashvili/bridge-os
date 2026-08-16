import {
  createWorkPackageSchema,
  workPackageParamsSchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import type { WorkPackageService } from "./work-package-service.js";

export function registerWorkPackageRoutes(
  app: FastifyInstance,
  service: WorkPackageService
): void {
  app.get("/api/v1/work-packages", async () => service.list());

  app.get("/api/v1/work-packages/:id", async (request) => {
    const { id } = workPackageParamsSchema.parse(request.params);
    const result = await service.get(id);
    if (result === null) {
      throw new HttpError({
        code: "WORK_PACKAGE_NOT_FOUND",
        details: { workPackageId: id },
        message: "Work package not found.",
        statusCode: 404
      });
    }
    return result;
  });

  app.post("/api/v1/work-packages", async (request, reply) => {
    const input = createWorkPackageSchema.parse(request.body);
    const result = await service.create(input);
    if (result.outcome === "CREATED") {
      return reply.status(201).send(result.response);
    }
    if (result.outcome === "INTERVENTION_NOT_FOUND") {
      throw new HttpError({
        code: "INTERVENTION_NOT_FOUND",
        details: { plannedInterventionId: result.plannedInterventionId },
        message: "Planned intervention not found.",
        statusCode: 404
      });
    }
    if (result.outcome === "INTERVENTION_NOT_ACTIONABLE") {
      throw new HttpError({
        code: "INTERVENTION_NOT_ACTIONABLE",
        details: { plannedInterventionId: result.plannedInterventionId },
        message: "Completed interventions cannot create a new work package.",
        statusCode: 409
      });
    }
    throw new HttpError({
      code: "WORK_PACKAGE_ALREADY_EXISTS",
      details: {
        plannedInterventionId: result.plannedInterventionId,
        workPackageId: result.workPackageId
      },
      message: "A work package already exists for this intervention.",
      statusCode: 409
    });
  });

  app.delete("/api/v1/work-packages/:id", async (request, reply) => {
    const { id } = workPackageParamsSchema.parse(request.params);
    const result = await service.remove(id);
    if (result.outcome === "WORK_PACKAGE_NOT_FOUND") {
      throw new HttpError({
        code: "WORK_PACKAGE_NOT_FOUND",
        details: { workPackageId: result.workPackageId },
        message: "Work package not found.",
        statusCode: 404
      });
    }
    return reply.status(204).send();
  });
}
