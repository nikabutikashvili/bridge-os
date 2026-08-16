import {
  budgetResponseSchema,
  errorEnvelopeSchema,
  type BudgetResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getBudget(year: number): Promise<BudgetResponse> {
  const url = new URL("/api/v1/budget", getWebEnv().NEXT_PUBLIC_API_URL);
  url.searchParams.set("year", String(year));
  const response = await fetch(url, { next: { revalidate: 30 } });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = errorEnvelopeSchema.safeParse(payload);
    const detail = error.success
      ? `${error.data.error.code}: ${error.data.error.message}`
      : `HTTP ${String(response.status)}`;
    throw new Error(`Unable to load the budget program. ${detail}`);
  }
  return budgetResponseSchema.parse(await response.json());
}
