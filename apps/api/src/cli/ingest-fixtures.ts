import {
  createDatabaseConnection,
  validateDevelopmentDatabaseEnvironment
} from "@bridge-os/db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadApiEnv, loadExtractionModelEnv } from "../config/env.js";
import { DocumentIngestionService } from "../features/documents/document-ingestion-service.js";
import { LocalDocumentStorage } from "../features/documents/local-document-storage.js";
import { createOcrPdfParser } from "../features/documents/pdfjs-parser.js";
import { PostgresDocumentCatalog } from "../features/documents/postgres-document-catalog.js";
import {
  fixtureCommandHelp,
  parseFixtureCommand
} from "../features/demo-ingestion/fixture-command.js";
import { loadFixturePdfs } from "../features/demo-ingestion/fixture-files.js";
import {
  FixtureIngestionService,
  type FixtureIngestionReport
} from "../features/demo-ingestion/fixture-ingestion-service.js";
import { ExtractionPipelineService } from "../features/extraction/extraction-pipeline-service.js";
import { ModelBackedExtractionProvider } from "../features/extraction/model/model-backed-extraction-provider.js";
import { OpenAiStructuredModelClient } from "../features/extraction/model/openai-structured-model-client.js";
import { PostgresExtractionStore } from "../features/extraction/postgres-extraction-store.js";

const command = parseFixtureCommand(process.argv.slice(2));
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
if (command.kind === "HELP") {
  process.stdout.write(`${fixtureCommandHelp}\n`);
} else {
  validateDevelopmentDatabaseEnvironment(process.env);
  const apiEnv = loadApiEnv();
  const modelEnv = loadExtractionModelEnv();
  const connection = createDatabaseConnection({ DATABASE_URL: apiEnv.DATABASE_URL });
  const logger = {
    error(context: Readonly<Record<string, unknown>>, message: string): void {
      writeLog("error", context, message);
    },
    info(context: Readonly<Record<string, unknown>>, message: string): void {
      writeLog("info", context, message);
    }
  };

  try {
    const extraction = new ExtractionPipelineService({
      logger,
      provider: new ModelBackedExtractionProvider({
        client: new OpenAiStructuredModelClient({
          apiKey: modelEnv.OPENAI_API_KEY,
          ...(modelEnv.OPENAI_BASE_URL === undefined
            ? {}
            : { baseUrl: modelEnv.OPENAI_BASE_URL }),
          maxOutputTokens: modelEnv.EXTRACTION_MODEL_MAX_OUTPUT_TOKENS,
          model: modelEnv.EXTRACTION_MODEL
        })
      }),
      store: new PostgresExtractionStore(connection.db)
    });
    const documents = new DocumentIngestionService({
      catalog: new PostgresDocumentCatalog(connection.db),
      logger,
      maxUploadBytes: apiEnv.DOCUMENT_MAX_UPLOAD_BYTES,
      parser: createOcrPdfParser(),
      storage: new LocalDocumentStorage(apiEnv.DOCUMENT_STORAGE_ROOT)
    });
    const service = new FixtureIngestionService({ documents, extraction });
    const files = await loadFixturePdfs(resolve(repositoryRoot, command.directory));
    const report = await service.ingest(files, {
      expectedDocumentCount: command.expectedDocumentCount,
      reextract: command.reextract,
      reparse: command.reparse
    });
    process.stdout.write(
      command.json ? `${JSON.stringify(report, null, 2)}\n` : formatReport(report)
    );
    if (report.failures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    logger.error({ err: error }, "Fixture ingestion command failed");
    process.exitCode = 1;
  } finally {
    await connection.close();
  }
}

function formatReport(report: FixtureIngestionReport): string {
  const lines = [
    "Bauwerksbuch fixture ingestion",
    `  Files discovered: ${String(report.filesDiscovered)}`,
    `  Documents ingested: ${String(report.documentsIngested)}`,
    `  Documents skipped by checksum: ${String(report.documentsSkippedByChecksum)}`,
    `  Bridges created: ${String(report.bridgesCreated)}`,
    `  Bridges updated: ${String(report.bridgesUpdated)}`,
    `  Bridges unchanged: ${String(report.bridgesUnchanged)}`,
    `  Inspections extracted: ${String(report.inspectionsExtracted)}`,
    `  Findings extracted: ${String(report.findingsExtracted)}`,
    `  Recommendations extracted: ${String(report.recommendationsExtracted)}`,
    `  Validation failures: ${String(report.validationFailures)}`,
    `  Total failures: ${String(report.failures.length)}`
  ];
  for (const failure of report.failures) {
    lines.push(
      `  FAILURE ${failure.filename} [${failure.stage}/${failure.code}]: ${failure.message}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function writeLog(
  level: "error" | "info",
  context: Readonly<Record<string, unknown>>,
  message: string
): void {
  process.stderr.write(
    `${JSON.stringify({ ...normalizeLogContext(context), level, message })}\n`
  );
}

function normalizeLogContext(
  context: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      value instanceof Error
        ? { message: value.message, name: value.name, stack: value.stack }
        : value
    ])
  );
}
