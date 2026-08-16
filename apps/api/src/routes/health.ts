import { healthResponseSchema } from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

export function registerHealthRoute(app: FastifyInstance): void {
  app.get("/health", () => {
    return healthResponseSchema.parse({
      service: "api",
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });
}

