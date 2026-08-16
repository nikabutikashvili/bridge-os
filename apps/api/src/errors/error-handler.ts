import { errorEnvelopeSchema } from "@bridge-os/contracts";
import { ZodError } from "zod";
import type { FastifyInstance } from "fastify";

import { HttpError } from "./http-error.js";

interface NormalizedError {
  readonly code: string;
  readonly details?: unknown;
  readonly message: string;
  readonly statusCode: number;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeError(error);

    request.log.error(
      {
        code: normalized.code,
        err: error,
        requestId: request.id,
        statusCode: normalized.statusCode
      },
      "Request failed"
    );

    const response = errorEnvelopeSchema.parse({
      error: {
        code: normalized.code,
        message: normalized.message,
        requestId: request.id,
        ...(normalized.details === undefined
          ? {}
          : { details: normalized.details })
      }
    });

    reply.status(normalized.statusCode).send(response);
  });
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof HttpError) {
    return {
      code: error.code,
      details: error.details,
      message: error.message,
      statusCode: error.statusCode
    };
  }

  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      details: error.issues,
      message: "Request validation failed.",
      statusCode: 400
    };
  }

  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    const statusCode = error.statusCode;
    return {
      code: statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "HTTP_ERROR",
      message:
        statusCode >= 500 ? "An unexpected error occurred." : error.message,
      statusCode
    };
  }

  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
    statusCode: 500
  };
}
