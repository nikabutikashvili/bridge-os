import {
  budgetResponseSchema,
  budgetScenarioCompareResponseSchema,
  budgetScenarioListResponseSchema,
  budgetScenarioResponseSchema,
  errorEnvelopeSchema,
  type BudgetResponse,
  type BudgetScenarioCompareResponse,
  type BudgetScenarioListResponse,
  type BudgetScenarioResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getBudget(year: number): Promise<BudgetResponse> {
  const url = new URL("/api/v1/budget", getWebEnv().NEXT_PUBLIC_API_URL);
  url.searchParams.set("year", String(year));
  return fetchJson(url, budgetResponseSchema, "Unable to load the budget program.");
}

export async function getBudgetScenarios(): Promise<BudgetScenarioListResponse> {
  const url = new URL("/api/v1/budget/scenarios", getWebEnv().NEXT_PUBLIC_API_URL);
  return fetchJson(
    url,
    budgetScenarioListResponseSchema,
    "Unable to load budget scenarios."
  );
}

export async function getBudgetScenario(
  scenarioId: string
): Promise<BudgetScenarioResponse> {
  const url = new URL(
    `/api/v1/budget/scenarios/${scenarioId}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  return fetchJson(url, budgetScenarioResponseSchema, "Unable to load the budget scenario.");
}

export async function getBudgetScenarioCompare(
  leftId: string,
  rightId: string
): Promise<BudgetScenarioCompareResponse> {
  const url = new URL(
    "/api/v1/budget/scenarios/compare",
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  url.searchParams.set("left", leftId);
  url.searchParams.set("right", rightId);
  return fetchJson(
    url,
    budgetScenarioCompareResponseSchema,
    "Unable to compare budget scenarios."
  );
}

async function fetchJson<Schema extends { parse: (value: unknown) => unknown }>(
  url: URL,
  schema: Schema,
  message: string
): Promise<ReturnType<Schema["parse"]>> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = errorEnvelopeSchema.safeParse(payload);
    const detail = error.success
      ? `${error.data.error.code}: ${error.data.error.message}`
      : `HTTP ${String(response.status)}`;
    throw new Error(`${message} ${detail}`);
  }
  return schema.parse(await response.json()) as ReturnType<Schema["parse"]>;
}
