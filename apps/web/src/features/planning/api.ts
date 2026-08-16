import {
  errorEnvelopeSchema,
  planningResponseSchema,
  type PlanningQuery,
  type PlanningResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getPlanning(
  query: PlanningQuery
): Promise<PlanningResponse> {
  const url = new URL("/api/v1/planning", getWebEnv().NEXT_PUBLIC_API_URL);
  url.searchParams.set("view", query.view);
  url.searchParams.set("page", String(query.page));
  url.searchParams.set("pageSize", String(query.pageSize));

  const response = await fetch(url, { next: { revalidate: 30 } });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = errorEnvelopeSchema.safeParse(payload);
    const detail = error.success
      ? `${error.data.error.code}: ${error.data.error.message}`
      : `HTTP ${String(response.status)}`;
    throw new Error(`Unable to load maintenance planning. ${detail}`);
  }
  return planningResponseSchema.parse(await response.json());
}
