import { createDatabaseConnection } from "./connection.js";
import { validateDevelopmentDatabaseEnvironment } from "./development-database.js";
import {
  developmentFixtureSummary,
  seedDevelopmentFixtures
} from "./seed-development-fixtures.js";

const environment = validateDevelopmentDatabaseEnvironment(process.env);
const connection = createDatabaseConnection({ DATABASE_URL: environment.databaseUrl });

try {
  await seedDevelopmentFixtures(connection.db);
  console.info(
    JSON.stringify({
      database: environment.databaseName,
      event: "database.seed.completed",
      fixtures: developmentFixtureSummary
    })
  );
} finally {
  await connection.close();
}
