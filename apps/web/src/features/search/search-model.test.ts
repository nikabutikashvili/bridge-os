import type { GlobalSearchResponse } from "@bridge-os/contracts";
import { describe, expect, it } from "vitest";

import {
  buildGlobalSearchGroups,
  flattenGlobalSearchOptions
} from "./search-model";

const bridgeId = "44058840-0000-4000-8000-000000000001";
const findingId = "44058840-0000-4000-8000-000000000304";
const recommendationId = "44058840-0000-4000-8000-000000000404";

describe("global search result navigation", () => {
  it("builds bridge, finding drawer, and recommendation context links", () => {
    const options = flattenGlobalSearchOptions(
      buildGlobalSearchGroups(responseFixture)
    );

    expect(options.map((option) => option.href)).toEqual([
      `/bridges/${bridgeId}`,
      `/bridges/${bridgeId}?tab=findings&finding=${findingId}`,
      `/bridges/${bridgeId}?tab=recommendations#recommendation-${recommendationId}`
    ]);
  });

  it("preserves group totals when only a bounded result set is shown", () => {
    const groups = buildGlobalSearchGroups(responseFixture);
    expect(groups.find((group) => group.key === "findings")).toMatchObject({
      label: "Findings",
      totalItems: 4
    });
  });
});

const bridge = {
  externalStructureNumber: "4405884",
  id: bridgeId,
  name: "Heideckhofweg",
  road: "A57"
};

const responseFixture: GlobalSearchResponse = {
  query: "joint",
  groups: {
    bridges: {
      items: [
        {
          ...bridge,
          location: {
            district: "Wesel",
            locality: "Millingen",
            municipality: "Rheinberg"
          }
        }
      ],
      totalItems: 1
    },
    findings: {
      items: [
        {
          bridge,
          defectType: "Pavement joint",
          description: "Damaged pavement joint",
          id: findingId,
          location: "North and south abutments",
          sourceIdentifier: "S-004",
          status: "OPEN"
        }
      ],
      totalItems: 4
    },
    recommendations: {
      items: [
        {
          bridge,
          description: "Renew the pavement joints",
          id: recommendationId,
          status: "OPEN",
          urgency: "MEDIUM_TERM",
          workType: "PAVEMENT_JOINT_REPAIR"
        }
      ],
      totalItems: 1
    }
  }
};
