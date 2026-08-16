import { describe, expect, it } from "vitest";

import {
  formatConditionScore,
  formatCurrency,
  formatGermanDate,
  formatMeasurement,
  formatPercentage
} from "./formatters";

describe("German display formatters", () => {
  it("formats source dates without a timezone day shift", () => {
    expect(formatGermanDate("2023-05-23")).toBe("23.05.2023");
  });

  it("formats measurements and condition scores with decimal commas", () => {
    expect(formatMeasurement("7.230", "m")).toBe("7,23 m");
    expect(formatConditionScore("1.8")).toBe("1,8");
  });

  it("formats money and percentages for German readers", () => {
    expect(normalizeWhitespace(formatCurrency("24000", "EUR"))).toBe(
      "24.000,00 €"
    );
    expect(formatPercentage("9.0")).toBe("9 %");
  });

  it("keeps missing values explicit and rejects malformed values", () => {
    expect(formatGermanDate(null)).toBe("Not recorded");
    expect(formatMeasurement(undefined, "m")).toBe("Not recorded");
    expect(() => formatConditionScore("unknown")).toThrowError(RangeError);
    expect(() => formatConditionScore(" ")).toThrowError(RangeError);
    expect(() => formatGermanDate("2023-02-31")).toThrowError(RangeError);
    expect(() => formatGermanDate("not-a-date")).toThrowError(RangeError);
  });
});

function normalizeWhitespace(value: string): string {
  return value.replace(/\s/gu, " ");
}
