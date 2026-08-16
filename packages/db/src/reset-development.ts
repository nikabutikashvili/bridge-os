import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabaseConnection } from "./connection.js";
import { validateDevelopmentResetEnvironment } from "./development-database.js";
import { migrationsFolder } from "./migrations.js";
import { seedDevelopmentFixtures } from "./seed-development-fixtures.js";

const environment = validateDevelopmentResetEnvironment(process.env);
const connection = createDatabaseConnection({ DATABASE_URL: environment.databaseUrl });

try {
  await connection.pool.query('drop schema if exists "public" cascade');
  await connection.pool.query('drop schema if exists "drizzle" cascade');
  await connection.pool.query('create schema "public"');
  await migrate(connection.db, { migrationsFolder });
  await seedDevelopmentFixtures(connection.db);
  console.info(
    JSON.stringify({
      database: environment.databaseName,
      event: "database.development_reset.completed"
    })
  );
} finally {
  await connection.close();
}
