import { uuidSchema } from "@bridge-os/contracts";
import { z } from "zod";

export type BudgetSearchParams = Record<string, string | string[] | undefined>;

export const budgetViewSchema = z.enum(["scenarios", "program", "compare"]);

const budgetPageQuerySchema = z
  .object({
    view: budgetViewSchema.optional(),
    year: z.coerce.number().int().min(1700).max(2200).optional(),
    id: uuidSchema.optional(),
    left: uuidSchema.optional(),
    right: uuidSchema.optional()
  })
  .strict();

export interface BudgetPageQuery {
  readonly view: "scenarios" | "program" | "compare";
  readonly year: number;
  readonly scenarioId: string | null;
  readonly leftId: string | null;
  readonly rightId: string | null;
}

export function parseBudgetSearchParams(
  searchParams: BudgetSearchParams,
  currentYear = new Date().getUTCFullYear()
): BudgetPageQuery {
  const parsed = budgetPageQuerySchema.parse({
    view: scalar(searchParams["view"]),
    year: scalar(searchParams["year"]),
    id: scalar(searchParams["id"]),
    left: scalar(searchParams["left"]),
    right: scalar(searchParams["right"])
  });
  const year = parsed.year ?? currentYear;
  if (parsed.view === "compare") {
    return {
      view: "compare",
      year,
      scenarioId: parsed.id ?? null,
      leftId: parsed.left ?? null,
      rightId: parsed.right ?? null
    };
  }
  if (parsed.view === "program" || (parsed.view === undefined && parsed.year !== undefined)) {
    return {
      view: "program",
      year,
      scenarioId: null,
      leftId: null,
      rightId: null
    };
  }
  return {
    view: "scenarios",
    year,
    scenarioId: parsed.id ?? null,
    leftId: parsed.left ?? null,
    rightId: parsed.right ?? null
  };
}

export function budgetProgramHref(year: number): string {
  return `/budget?year=${String(year)}`;
}

export function budgetScenariosHref(scenarioId?: string): string {
  return scenarioId === undefined
    ? "/budget?view=scenarios"
    : `/budget?view=scenarios&id=${scenarioId}`;
}

export function budgetCompareHref(leftId: string, rightId: string): string {
  return `/budget?view=compare&left=${leftId}&right=${rightId}`;
}

export function budgetHref(year: number): string {
  return budgetProgramHref(year);
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
