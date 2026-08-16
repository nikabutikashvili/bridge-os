import { describe, expect, it } from "vitest";

import { buildDocumentSourceUrl } from "../src/features/bridges/source-url.js";

describe("document source URL", () => {
  it("opens an available HTTP source at the cited PDF page", () => {
    expect(
      buildDocumentSourceUrl("https://files.example.test/report.pdf?token=fixture", 9)
    ).toBe("https://files.example.test/report.pdf?token=fixture#page=9");
  });

  it("does not expose absent, malformed, or unsafe source metadata", () => {
    expect(buildDocumentSourceUrl(null, 9)).toBeNull();
    expect(buildDocumentSourceUrl("not a URL", 9)).toBeNull();
    expect(buildDocumentSourceUrl("file:///tmp/report.pdf", 9)).toBeNull();
    expect(buildDocumentSourceUrl("javascript:alert(1)", 9)).toBeNull();
  });
});
