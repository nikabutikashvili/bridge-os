import { budgetQuerySchema, type BudgetQuery } from "@bridge-os/contracts";

export type BudgetSearchParams = Record<string, string | string[] | undefined>;

export function parseBudgetSearchParams(
  searchParams: BudgetSearchParams,
  currentYear = new Date().getUTCFullYear()
): BudgetQuery {
  return budgetQuerySchema.parse({
    year: scalar(searchParams["year"]) ?? currentYear
  });
}

export function budgetHref(year: number): string {
  return `/budget?year=${String(year)}`;
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
