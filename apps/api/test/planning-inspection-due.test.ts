import { describe, expect, it } from "vitest";

import { deriveInspectionDueStatus } from "../src/features/planning/inspection-due.js";

describe("deriveInspectionDueStatus", () => {
  it("keeps missing cycle facts unknown", () => {
    expect(deriveInspectionDueStatus(undefined, "2026-08-15")).toBe("UNKNOWN");
    expect(
      deriveInspectionDueStatus(
        { cycleMonths: null, inspectedOn: "2023-05-23" },
        "2026-08-15"
      )
    ).toBe("UNKNOWN");
  });

  it("separates overdue, due-soon, and current cycles", () => {
    expect(
      deriveInspectionDueStatus(
        { cycleMonths: 12, inspectedOn: "2025-08-14" },
        "2026-08-15"
      )
    ).toBe("OVERDUE");
    expect(
      deriveInspectionDueStatus(
        { cycleMonths: 12, inspectedOn: "2025-08-15" },
        "2026-08-15"
      )
    ).toBe("DUE_SOON");
    expect(
      deriveInspectionDueStatus(
        { cycleMonths: 72, inspectedOn: "2023-05-23" },
        "2026-08-15"
      )
    ).toBe("CURRENT");
  });

  it("clamps month-end cycles to the target calendar month", () => {
    expect(
      deriveInspectionDueStatus(
        { cycleMonths: 1, inspectedOn: "2025-01-31" },
        "2025-03-01"
      )
    ).toBe("OVERDUE");
  });
});
