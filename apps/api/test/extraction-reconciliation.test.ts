import { describe, expect, it } from "vitest";

import {
  extractionFingerprint,
  staleBindings,
  type DesiredEntity,
  type ExistingBinding
} from "../src/features/extraction/postgres-extraction-reconciliation.js";

describe("staleBindings", () => {
  it("returns previously extracted records that the new bundle no longer includes", () => {
    const existing: ExistingBinding[] = [
      binding("BRIDGE", "bridge:4405884", "bridge-1"),
      binding("TRAFFIC_OBSERVATION", "bridge:4405884:traffic:2015:year", "traffic-1"),
      binding("INSPECTION", "bridge:4405884:partial:1:inspection:insp-1:OTHER", "insp-1")
    ];
    const desired: DesiredEntity[] = [
      desiredEntity("BRIDGE", "bridge:4405884", "bridge-1"),
      desiredEntity(
        "INSPECTION",
        "bridge:4405884:partial:1:inspection:2019-08-06:MAIN",
        "insp-2"
      )
    ];

    expect(staleBindings(existing, desired)).toEqual([
      existing[1],
      existing[2]
    ]);
  });

  it("treats Postgres numeric scale and date objects as unchanged values", () => {
    expect(extractionFingerprint({ lengthM: "7.23", areaSqM: "117" })).toBe(
      extractionFingerprint({ lengthM: "7.230", areaSqM: "117.000" })
    );
    expect(extractionFingerprint({ inspectedOn: "2019-08-06" })).toBe(
      extractionFingerprint({
        inspectedOn: new Date("2019-08-06T00:00:00.000Z")
      })
    );
  });

  it("returns nothing when every previous identity is still present", () => {
    const existing = [binding("BRIDGE", "bridge:4405884", "bridge-1")];
    const desired = [desiredEntity("BRIDGE", "bridge:4405884", "bridge-1")];

    expect(staleBindings(existing, desired)).toEqual([]);
  });
});

function binding(
  entityKind: ExistingBinding["entityKind"],
  sourceIdentityKey: string,
  entityId: string
): ExistingBinding {
  return {
    entityId,
    entityKind,
    lastAppliedFingerprint: "a".repeat(64),
    sourceIdentityKey
  };
}

function desiredEntity(
  entityKind: DesiredEntity["entityKind"],
  sourceIdentityKey: string,
  entityId: string
): DesiredEntity {
  return {
    entityId,
    entityKind,
    fingerprint: "b".repeat(64),
    sourceIdentityKey
  };
}
