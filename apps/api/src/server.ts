import { buildApp } from "./app.js";
import { loadApiEnv } from "./config/env.js";

const env = loadApiEnv();
const app = buildApp({ env });

const shutdownSignals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

for (const signal of shutdownSignals) {
  process.on(signal, () => {
    app.log.info({ signal }, "Shutting down API");
    app.close().catch((error: unknown) => {
      app.log.error({ err: error }, "Failed to close API cleanly");
      process.exitCode = 1;
    });
  });
}

try {
  await app.listen({
    host: env.API_HOST,
    port: env.API_PORT
  });
} catch (error) {
  app.log.error({ err: error }, "Failed to start API");
  process.exit(1);
}

