import { z } from "zod";
import { describe, expect, it } from "vitest";

import { networkFixture, networkFormulaVersion } from "../src/fixtures/network/index.js";

describe("network development fixture", () => {
  it("uses stable unique metric UUIDs", () => {
    const ids = networkFixture.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => z.string().uuid().safeParse(id).success)).toBe(true);
    expect(networkFormulaVersion).toBe("closure-impact-v1");
  });

  it("covers each demo structure with a longer A4 valley detour than A57", () => {
    const byNumber = new Map(
      networkFixture.map((entry) => [entry.externalStructureNumber, entry])
    );

    expect([...byNumber.keys()].sort()).toEqual([
      "4405884",
      "5009705",
      "5010710",
      "5010723",
      "5011735",
      "9999999"
    ]);
    expect(Number(byNumber.get("4405884")?.additionalDistanceKm)).toBe(9.5);
    expect(Number(byNumber.get("5011735")?.additionalDistanceKm)).toBe(41);
    expect(byNumber.get("5010710")?.alternativeCrossingCount).toBe(0);
  });
});
