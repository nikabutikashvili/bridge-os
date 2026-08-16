import {
  bridgeFindingParamsSchema,
  bridgeIdParamsSchema,
  bridgePortfolioQuerySchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import type { DocumentStorage } from "../documents/document-storage.js";
import type { BridgePortfolioReader } from "./bridge-reader.js";

export function registerBridgeRoutes(
  app: FastifyInstance,
  reader: BridgePortfolioReader,
  storage: DocumentStorage
): void {
  app.get("/api/v1/bridges", async (request) => {
    const query = bridgePortfolioQuerySchema.parse(request.query);
    return reader.listBridges(query);
  });

  app.get("/api/v1/bridges/:id", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getBridge(id), id);
  });

  app.get("/api/v1/bridges/:id/photo", async (request, reply) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    const photo = await reader.getBridgePhoto(id);
    if (photo === null) {
      throw new HttpError({
        code: "BRIDGE_PHOTO_NOT_FOUND",
        message: "No photograph is stored for this bridge.",
        statusCode: 404,
        details: { bridgeId: id }
      });
    }

    let bytes: Uint8Array;
    try {
      bytes = await storage.get(photo.storageKey);
    } catch {
      throw new HttpError({
        code: "BRIDGE_PHOTO_NOT_FOUND",
        message: "No photograph is stored for this bridge.",
        statusCode: 404,
        details: { bridgeId: id }
      });
    }

    return reply
      .header("cache-control", "private, max-age=86400")
      .type(photo.mimeType)
      .send(Buffer.from(bytes));
  });

  app.get("/api/v1/bridges/:id/inspections", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getInspections(id), id);
  });

  app.get("/api/v1/bridges/:id/findings", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getFindings(id), id);
  });

  app.get("/api/v1/bridges/:id/findings/:findingId", async (request) => {
    const { findingId, id } = bridgeFindingParamsSchema.parse(request.params);
    const finding = await reader.getFinding(id, findingId);
    if (finding === null) {
      throw new HttpError({
        code: "FINDING_NOT_FOUND",
        message: "Finding not found for this bridge.",
        statusCode: 404,
        details: { bridgeId: id, findingId }
      });
    }
    return finding;
  });

  app.get("/api/v1/bridges/:id/recommendations", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getRecommendations(id), id);
  });

  app.get("/api/v1/bridges/:id/history", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getHistory(id), id);
  });

  app.get("/api/v1/bridges/:id/documents", async (request) => {
    const { id } = bridgeIdParamsSchema.parse(request.params);
    return requireBridge(await reader.getDocuments(id), id);
  });
}

function requireBridge<T>(response: T | null, id: string): T {
  if (response === null) {
    throw new HttpError({
      code: "BRIDGE_NOT_FOUND",
      message: "Bridge not found.",
      statusCode: 404,
      details: { bridgeId: id }
    });
  }

  return response;
}
