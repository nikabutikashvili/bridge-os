import { randomUUID } from "node:crypto";

import {
  createDatabaseConnection,
  type DatabaseConnection
} from "@bridge-os/db";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";

import { loadApiEnv, type ApiEnv } from "./config/env.js";
import { registerErrorHandler } from "./errors/error-handler.js";
import type { BudgetService } from "./features/budget/budget-service.js";
import { PostgresBudgetService } from "./features/budget/postgres-budget-service.js";
import { registerBudgetRoutes } from "./features/budget/routes.js";
import type { BridgePortfolioReader } from "./features/bridges/bridge-reader.js";
import { PostgresBridgePortfolioReader } from "./features/bridges/postgres-bridge-reader.js";
import { registerBridgeRoutes } from "./features/bridges/routes.js";
import { DocumentIngestionService } from "./features/documents/document-ingestion-service.js";
import type { DocumentOverviewReader } from "./features/documents/document-overview-reader.js";
import type { DocumentService } from "./features/documents/document-service.js";
import type { DocumentStorage } from "./features/documents/document-storage.js";
import { LocalDocumentStorage } from "./features/documents/local-document-storage.js";
import type { PdfParser } from "./features/documents/pdf-parser.js";
import { createOcrPdfParser } from "./features/documents/pdfjs-parser.js";
import { PostgresDocumentCatalog } from "./features/documents/postgres-document-catalog.js";
import { PostgresDocumentOverviewReader } from "./features/documents/postgres-document-overview-reader.js";
import { registerDocumentRoutes } from "./features/documents/routes.js";
import { PostgresPlanningService } from "./features/planning/postgres-planning-service.js";
import type { PlanningService } from "./features/planning/planning-service.js";
import { registerPlanningRoutes } from "./features/planning/routes.js";
import { PostgresGlobalSearchReader } from "./features/search/postgres-search-reader.js";
import { registerGlobalSearchRoute } from "./features/search/routes.js";
import type { GlobalSearchReader } from "./features/search/search-reader.js";
import { PostgresWorkPackageService } from "./features/work-packages/postgres-work-package-service.js";
import { registerWorkPackageRoutes } from "./features/work-packages/routes.js";
import type { WorkPackageService } from "./features/work-packages/work-package-service.js";
import { registerHealthRoute } from "./routes/health.js";

export interface BuildAppOptions {
  readonly bridgePortfolioReader?: BridgePortfolioReader;
  readonly budgetService?: BudgetService;
  readonly databaseConnection?: DatabaseConnection;
  readonly documentService?: DocumentService;
  readonly documentOverviewReader?: DocumentOverviewReader;
  readonly documentStorage?: DocumentStorage;
  readonly env?: ApiEnv;
  readonly pdfParser?: PdfParser;
  readonly planningService?: PlanningService;
  readonly searchReader?: GlobalSearchReader;
  readonly workPackageService?: WorkPackageService;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const env = options.env ?? loadApiEnv();
  const app = Fastify({
    genReqId: (request) => {
      const requestId = request.headers["x-request-id"];
      if (typeof requestId === "string" && requestId.length > 0) {
        return requestId;
      }

      if (Array.isArray(requestId) && requestId[0]) {
        return requestId[0];
      }

      return randomUUID();
    },
    logger: {
      level: env.LOG_LEVEL,
      redact: ["req.headers.authorization"]
    },
    requestIdHeader: "x-request-id"
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-request-id", request.id);
    done();
  });

  app.register(multipart, {
    limits: {
      fileSize: env.DOCUMENT_MAX_UPLOAD_BYTES,
      files: 1,
      parts: 1
    }
  });

  const dependencies = resolveDependencies(options, env, app);
  const ownedConnection = dependencies.ownedConnection;

  if (ownedConnection !== null) {
    app.addHook("onClose", async () => {
      await ownedConnection.close();
    });
  }

  registerErrorHandler(app);
  registerHealthRoute(app);
  registerBridgeRoutes(
    app,
    dependencies.bridgeReader,
    dependencies.documentStorage
  );
  registerBudgetRoutes(app, dependencies.budgetService);
  registerDocumentRoutes(
    app,
    dependencies.documentService,
    env.DOCUMENT_MAX_UPLOAD_BYTES,
    dependencies.documentOverviewReader
  );
  registerPlanningRoutes(app, dependencies.planningService);
  registerGlobalSearchRoute(app, dependencies.searchReader);
  registerWorkPackageRoutes(app, dependencies.workPackageService);

  return app;
}

interface AppDependencies {
  readonly bridgeReader: BridgePortfolioReader;
  readonly budgetService: BudgetService;
  readonly documentService: DocumentService;
  readonly documentOverviewReader: DocumentOverviewReader;
  readonly documentStorage: DocumentStorage;
  readonly ownedConnection: DatabaseConnection | null;
  readonly planningService: PlanningService;
  readonly searchReader: GlobalSearchReader;
  readonly workPackageService: WorkPackageService;
}

function resolveDependencies(
  options: BuildAppOptions,
  env: ApiEnv,
  app: FastifyInstance
): AppDependencies {
  const needsDatabase =
    options.bridgePortfolioReader === undefined ||
    options.budgetService === undefined ||
    options.documentOverviewReader === undefined ||
    options.documentService === undefined ||
    options.planningService === undefined ||
    options.searchReader === undefined ||
    options.workPackageService === undefined;
  const connection = needsDatabase
    ? options.databaseConnection ??
      createDatabaseConnection({ DATABASE_URL: env.DATABASE_URL })
    : null;
  const documentStorage =
    options.documentStorage ?? new LocalDocumentStorage(env.DOCUMENT_STORAGE_ROOT);

  return {
    bridgeReader:
      options.bridgePortfolioReader ??
      new PostgresBridgePortfolioReader(requireConnection(connection).db),
    budgetService:
      options.budgetService ??
      new PostgresBudgetService(requireConnection(connection).db),
    documentService:
      options.documentService ??
      new DocumentIngestionService({
        catalog: new PostgresDocumentCatalog(requireConnection(connection).db),
        logger: app.log,
        maxUploadBytes: env.DOCUMENT_MAX_UPLOAD_BYTES,
        parser: options.pdfParser ?? createOcrPdfParser(),
        storage: documentStorage
      }),
    documentOverviewReader:
      options.documentOverviewReader ??
      new PostgresDocumentOverviewReader(requireConnection(connection).db),
    documentStorage,
    planningService:
      options.planningService ??
      new PostgresPlanningService(requireConnection(connection).db),
    searchReader:
      options.searchReader ??
      new PostgresGlobalSearchReader(requireConnection(connection).db),
    workPackageService:
      options.workPackageService ??
      new PostgresWorkPackageService(requireConnection(connection).db),
    ownedConnection:
      needsDatabase && options.databaseConnection === undefined ? connection : null
  };
}

function requireConnection(
  connection: DatabaseConnection | null
): DatabaseConnection {
  if (connection === null) {
    throw new Error("Database connection is required for default dependencies.");
  }
  return connection;
}
