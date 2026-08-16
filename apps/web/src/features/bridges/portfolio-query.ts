import {
  bridgePortfolioQuerySchema,
  type BridgePortfolioQuery
} from "@bridge-os/contracts";

export type PortfolioSearchParams = Record<
  string,
  string | string[] | undefined
>;

type QueryChanges = Partial<
  Record<keyof BridgePortfolioQuery, BridgePortfolioQuery[keyof BridgePortfolioQuery] | undefined>
>;

const queryKeys = [
  "page",
  "pageSize",
  "road",
  "conditionMin",
  "conditionMax",
  "constructionYearFrom",
  "constructionYearTo",
  "inspectionStatus",
  "hasOpenFinding",
  "recommendationUrgency",
  "findingStatus",
  "sort",
  "direction"
] as const satisfies readonly (keyof BridgePortfolioQuery)[];

export function parsePortfolioSearchParams(
  searchParams: PortfolioSearchParams
): BridgePortfolioQuery {
  const values: Record<string, string> = {};

  for (const key of queryKeys) {
    const value = searchParams[key];
    const scalar = Array.isArray(value) ? value[0] : value;
    if (scalar !== undefined && scalar.trim() !== "") {
      values[key] = scalar;
    }
  }

  return bridgePortfolioQuerySchema.parse(values);
}

export function portfolioHref(
  query: BridgePortfolioQuery,
  changes: QueryChanges = {}
): string {
  const merged = { ...query, ...changes };
  const params = new URLSearchParams();

  for (const key of queryKeys) {
    const value = merged[key];
    if (value !== undefined && shouldInclude(key, value)) {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString.length === 0 ? "/bridges" : `/bridges?${queryString}`;
}

function shouldInclude(
  key: keyof BridgePortfolioQuery,
  value: BridgePortfolioQuery[keyof BridgePortfolioQuery]
): boolean {
  if (key === "page" && value === 1) {
    return false;
  }
  if (key === "pageSize" && value === 25) {
    return false;
  }
  if (key === "sort" && value === "attention") {
    return false;
  }
  if (key === "direction" && value === "desc") {
    return false;
  }
  return true;
}
