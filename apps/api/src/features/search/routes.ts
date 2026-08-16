import { globalSearchQuerySchema } from "@bridge-os/contracts";
import type { FastifyInstance } from "fastify";

import type { GlobalSearchReader } from "./search-reader.js";

export function registerGlobalSearchRoute(
  app: FastifyInstance,
  reader: GlobalSearchReader
): void {
  app.get("/api/v1/search", async (request) => {
    const query = globalSearchQuerySchema.parse(request.query);
    return reader.search(query);
  });
}
