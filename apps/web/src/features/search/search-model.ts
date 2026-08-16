import type { GlobalSearchResponse } from "@bridge-os/contracts";

export type GlobalSearchGroupKey = keyof GlobalSearchResponse["groups"];

export interface GlobalSearchOption {
  readonly context: string;
  readonly detail: string;
  readonly domId: string;
  readonly group: GlobalSearchGroupKey;
  readonly href: string;
  readonly key: string;
  readonly title: string;
}

export interface GlobalSearchOptionGroup {
  readonly key: GlobalSearchGroupKey;
  readonly label: string;
  readonly options: readonly GlobalSearchOption[];
  readonly totalItems: number;
}

export function buildGlobalSearchGroups(
  response: GlobalSearchResponse
): readonly GlobalSearchOptionGroup[] {
  return [
    {
      key: "bridges",
      label: "Bridges",
      totalItems: response.groups.bridges.totalItems,
      options: response.groups.bridges.items.map((bridge) => ({
        context: compactJoin([
          bridge.externalStructureNumber === null
            ? null
            : `Structure ${bridge.externalStructureNumber}`,
          bridge.road
        ]),
        detail: compactJoin([
          bridge.location.locality,
          bridge.location.municipality,
          bridge.location.district
        ]),
        domId: `global-search-bridge-${bridge.id}`,
        group: "bridges" as const,
        href: `/bridges/${bridge.id}`,
        key: `bridge-${bridge.id}`,
        title: bridge.name ?? bridge.externalStructureNumber ?? "Unnamed bridge"
      }))
    },
    {
      key: "findings",
      label: "Findings",
      totalItems: response.groups.findings.totalItems,
      options: response.groups.findings.items.map((finding) => ({
        context: bridgeLabel(finding.bridge),
        detail: compactJoin([finding.defectType, finding.description]),
        domId: `global-search-finding-${finding.id}`,
        group: "findings" as const,
        href: `/bridges/${finding.bridge.id}?tab=findings&finding=${finding.id}`,
        key: `finding-${finding.id}`,
        title: finding.sourceIdentifier ?? finding.defectType ?? "Finding"
      }))
    },
    {
      key: "recommendations",
      label: "Recommendations",
      totalItems: response.groups.recommendations.totalItems,
      options: response.groups.recommendations.items.map((recommendation) => ({
        context: bridgeLabel(recommendation.bridge),
        detail: recommendation.description ?? "Description not recorded",
        domId: `global-search-recommendation-${recommendation.id}`,
        group: "recommendations" as const,
        href:
          `/bridges/${recommendation.bridge.id}?tab=recommendations` +
          `#recommendation-${recommendation.id}`,
        key: `recommendation-${recommendation.id}`,
        title: recommendation.workType ?? "Recommendation"
      }))
    }
  ];
}

export function flattenGlobalSearchOptions(
  groups: readonly GlobalSearchOptionGroup[]
): readonly GlobalSearchOption[] {
  return groups.flatMap((group) => group.options);
}

function bridgeLabel(bridge: {
  readonly externalStructureNumber: string | null;
  readonly name: string | null;
  readonly road: string | null;
}): string {
  return compactJoin([
    bridge.externalStructureNumber,
    bridge.name,
    bridge.road
  ]);
}

function compactJoin(values: readonly (string | null)[]): string {
  const present = values.filter((value): value is string => value !== null);
  return present.length === 0 ? "Not recorded" : present.join(" · ");
}
