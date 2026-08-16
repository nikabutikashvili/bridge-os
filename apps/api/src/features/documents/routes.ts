import {
  documentIdParamsSchema,
  documentPageParamsSchema
} from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import { HttpError } from "../../errors/http-error.js";
import { DocumentIngestionError } from "./document-ingestion-error.js";
import type { DocumentOverviewReader } from "./document-overview-reader.js";
import type { DocumentService } from "./document-service.js";

export function registerDocumentRoutes(
  app: FastifyInstance,
  service: DocumentService,
  maxUploadBytes: number,
  overviewReader: DocumentOverviewReader
): void {
  app.post("/api/v1/documents", async (request, reply) => {
    if (!request.isMultipart()) {
      throw new HttpError({
        code: "MULTIPART_REQUIRED",
        message: "Upload the PDF as multipart/form-data.",
        statusCode: 415
      });
    }

    let file;
    try {
      file = await request.file({
        limits: { fileSize: maxUploadBytes, files: 1, parts: 1 }
      });
    } catch (error) {
      if (isPayloadTooLarge(error)) {
        throw new HttpError({
          code: "DOCUMENT_TOO_LARGE",
          details: { maxUploadBytes },
          message: "The uploaded PDF exceeds the configured size limit.",
          statusCode: 413
        });
      }
      throw error;
    }

    if (file?.fieldname !== "file") {
      throw new HttpError({
        code: "DOCUMENT_FILE_REQUIRED",
        message: "A PDF is required in the 'file' multipart field.",
        statusCode: 400
      });
    }

    let content: Buffer;
    try {
      content = await file.toBuffer();
    } catch (error) {
      if (isPayloadTooLarge(error)) {
        throw new HttpError({
          code: "DOCUMENT_TOO_LARGE",
          details: { maxUploadBytes },
          message: "The uploaded PDF exceeds the configured size limit.",
          statusCode: 413
        });
      }
      throw error;
    }

    try {
      const result = await service.ingest({
        content,
        filename: file.filename,
        mimeType: file.mimetype
      });
      return await reply.status(result.duplicate ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof DocumentIngestionError) {
        throw new HttpError({
          code: error.code,
          details: error.details,
          message: error.message,
          statusCode: error.statusCode
        });
      }
      throw error;
    }
  });

  app.get("/api/v1/documents", async () => service.listDocuments());

  app.get("/api/v1/documents/overview", async () =>
    overviewReader.listOverview()
  );

  app.get("/api/v1/documents/:id", async (request) => {
    const { id } = documentIdParamsSchema.parse(request.params);
    const document = await service.getDocument(id);
    if (document === null) {
      throw documentNotFound(id);
    }
    return document;
  });

  app.get("/api/v1/documents/:id/pages/:pageNumber", async (request) => {
    const { id, pageNumber } = documentPageParamsSchema.parse(request.params);
    const page = await service.getPage(id, pageNumber);
    if (page === null) {
      throw new HttpError({
        code: "DOCUMENT_PAGE_NOT_FOUND",
        details: { documentId: id, pageNumber },
        message: "Document page not found.",
        statusCode: 404
      });
    }
    return page;
  });
}

function documentNotFound(id: string): HttpError {
  return new HttpError({
    code: "DOCUMENT_NOT_FOUND",
    details: { documentId: id },
    message: "Document not found.",
    statusCode: 404
  });
}

function isPayloadTooLarge(error: unknown): boolean {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    error.statusCode === 413
  );
}
