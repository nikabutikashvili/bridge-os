import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabaseConnection } from "./connection.js";
import { migrationsFolder } from "./migrations.js";

const connection = createDatabaseConnection();

try {
  await migrate(connection.db, { migrationsFolder });
} finally {
  await connection.close();
}
