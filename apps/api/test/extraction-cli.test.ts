import { describe, expect, it } from "vitest";

import { parseExtractCommand } from "../src/cli/extract-command.js";
import { loadExtractionModelEnv } from "../src/config/env.js";

describe("extraction CLI", () => {
  it("parses document extraction and failed-run retry commands", () => {
    expect(
      parseExtractCommand(["00000000-0000-4000-8000-000000000201"])
    ).toEqual({
      documentId: "00000000-0000-4000-8000-000000000201",
      kind: "EXTRACT"
    });
    expect(
      parseExtractCommand([
        "--retry",
        "00000000-0000-4000-8000-000000000202"
      ])
    ).toEqual({
      kind: "RETRY",
      runId: "00000000-0000-4000-8000-000000000202"
    });
  });

  it("validates model configuration only when extraction is composed", () => {
    expect(
      loadExtractionModelEnv({
        EXTRACTION_MODEL: "structured-model",
        OPENAI_API_KEY: "test-key"
      })
    ).toMatchObject({
      EXTRACTION_MODEL: "structured-model",
      EXTRACTION_MODEL_MAX_OUTPUT_TOKENS: 12_000,
      EXTRACTION_MODEL_PROVIDER: "openai"
    });
    expect(() =>
      loadExtractionModelEnv({ EXTRACTION_MODEL: "structured-model" })
    ).toThrow("OPENAI_API_KEY");
  });
});
