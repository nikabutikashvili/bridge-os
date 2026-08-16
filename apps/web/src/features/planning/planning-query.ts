import {
  planningQuerySchema,
  type PlanningQuery,
  type PlanningView
} from "@bridge-os/contracts";

export type PlanningSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parsePlanningSearchParams(
  searchParams: PlanningSearchParams
): PlanningQuery {
  return planningQuerySchema.parse({
    page: scalar(searchParams["page"]),
    pageSize: scalar(searchParams["pageSize"]),
    view: scalar(searchParams["view"])
  });
}

export function planningHref(view: PlanningView, page = 1): string {
  const params = new URLSearchParams();
  if (view !== "recommended-unplanned") {
    params.set("view", view);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query.length === 0 ? "/planning" : `/planning?${query}`;
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
