import {
  createWorkPackageSchema,
  workPackageDisclaimerSchema,
  workPackageReadinessItemSchema
} from "../src/index.js";
import { describe, expect, it } from "vitest";

describe("work package API contracts", () => {
  it("accepts only a strict planned-intervention creation command", () => {
    const plannedInterventionId = "44058840-0000-4000-8000-000000000703";
    expect(createWorkPackageSchema.safeParse({ plannedInterventionId }).success).toBe(
      true
    );
    expect(
      createWorkPackageSchema.safeParse({ plannedInterventionId, status: "READY" })
        .success
    ).toBe(false);
  });

  it("keeps the planning-review disclaimer exact", () => {
    expect(
      workPackageDisclaimerSchema.safeParse(
        "Planning draft — requires technical and procurement review."
      ).success
    ).toBe(true);
    expect(workPackageDisclaimerSchema.safeParse("Tender ready").success).toBe(
      false
    );
  });

  it("does not represent required verification as an available fact", () => {
    const result = workPackageReadinessItemSchema.safeParse({
      code: "SITE_VERIFICATION_REQUIRED",
      label: "Site verification required",
      state: "REQUIRED",
      detail: "Site conditions must be verified."
    });
    expect(result.success).toBe(true);
  });
});
