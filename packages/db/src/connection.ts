import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { z } from "zod";

import * as schema from "./schema/index.js";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url()
});

export type BridgeDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  readonly db: BridgeDatabase;
  readonly pool: pg.Pool;
  close: () => Promise<void>;
}

export function createDatabaseConnection(
  source: NodeJS.ProcessEnv = process.env
): DatabaseConnection {
  const env = databaseEnvSchema.parse(source);
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL
  });

  return {
    db: drizzle(pool, { schema }),
    pool,
    close: async () => {
      await pool.end();
    }
  };
}

