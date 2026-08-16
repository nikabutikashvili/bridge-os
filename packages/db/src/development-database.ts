import { z } from "zod";

const developmentDatabaseEnvironmentSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.literal("development")
  })
  .passthrough();

const resetEnvironmentSchema = developmentDatabaseEnvironmentSchema.extend({
  ALLOW_DATABASE_RESET: z.literal("bridge-os-local-reset")
});

const localHostnames = new Set(["127.0.0.1", "::1", "localhost"]);
const forbiddenDatabaseNameParts = ["prod", "production", "staging"];

export interface DevelopmentDatabaseEnvironment {
  readonly databaseName: string;
  readonly databaseUrl: string;
}

function validateLocalDatabaseUrl(databaseUrl: string): DevelopmentDatabaseEnvironment {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.slice(1));

  if (!localHostnames.has(url.hostname)) {
    throw new Error("Development database commands require a localhost DATABASE_URL.");
  }

  if (databaseName !== "bridge_os" && !databaseName.startsWith("bridge_os_")) {
    throw new Error('Development database name must be "bridge_os" or start with "bridge_os_".');
  }

  if (forbiddenDatabaseNameParts.some((part) => databaseName.toLowerCase().includes(part))) {
    throw new Error("Refusing to use a database whose name appears production-like.");
  }

  return { databaseName, databaseUrl };
}

export function validateDevelopmentDatabaseEnvironment(
  source: NodeJS.ProcessEnv
): DevelopmentDatabaseEnvironment {
  const environment = developmentDatabaseEnvironmentSchema.parse(source);
  return validateLocalDatabaseUrl(environment.DATABASE_URL);
}

export function validateDevelopmentResetEnvironment(
  source: NodeJS.ProcessEnv
): DevelopmentDatabaseEnvironment {
  const environment = resetEnvironmentSchema.parse(source);
  return validateLocalDatabaseUrl(environment.DATABASE_URL);
}
