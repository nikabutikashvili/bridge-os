import { createDatabaseConnection } from "@bridge-os/db";

import {
  loadApiEnv,
  loadExtractionModelEnv
} from "../config/env.js";
import { ExtractionPipelineService } from "../features/extraction/extraction-pipeline-service.js";
import { ModelBackedExtractionProvider } from "../features/extraction/model/model-backed-extraction-provider.js";
import { OpenAiStructuredModelClient } from "../features/extraction/model/openai-structured-model-client.js";
import { PostgresExtractionStore } from "../features/extraction/postgres-extraction-store.js";
import { extractCommandHelp, parseExtractCommand } from "./extract-command.js";

const cliLogger = {
  error(context: Readonly<Record<string, unknown>>, message: string): void {
    writeLog("error", context, message);
  },
  info(context: Readonly<Record<string, unknown>>, message: string): void {
    writeLog("info", context, message);
  }
};

const command = parseExtractCommand(process.argv.slice(2));
if (command.kind === "HELP") {
  process.stdout.write(`${extractCommandHelp}\n`);
} else {
  const apiEnv = loadApiEnv();
  const modelEnv = loadExtractionModelEnv();
  const connection = createDatabaseConnection({ DATABASE_URL: apiEnv.DATABASE_URL });
  const provider = new ModelBackedExtractionProvider({
    client: new OpenAiStructuredModelClient({
      apiKey: modelEnv.OPENAI_API_KEY,
      ...(modelEnv.OPENAI_BASE_URL === undefined
        ? {}
        : { baseUrl: modelEnv.OPENAI_BASE_URL }),
      maxOutputTokens: modelEnv.EXTRACTION_MODEL_MAX_OUTPUT_TOKENS,
      model: modelEnv.EXTRACTION_MODEL
    })
  });
  const service = new ExtractionPipelineService({
    logger: cliLogger,
    provider,
    store: new PostgresExtractionStore(connection.db)
  });

  try {
    const run =
      command.kind === "EXTRACT"
        ? await service.extract(command.documentId)
        : await service.retry(command.runId);
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
  } catch (error) {
    cliLogger.error({ err: error }, "Extraction command failed");
    process.exitCode = 1;
  } finally {
    await connection.close();
  }
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
