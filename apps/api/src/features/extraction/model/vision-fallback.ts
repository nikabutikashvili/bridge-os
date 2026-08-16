import { hasInsufficientPageText } from "../../documents/page-text.js";
import type { ExtractionPageInput } from "../extraction-provider.js";
import type { ModelImageInput } from "./structured-model-client.js";

export type VisionFallbackDecision =
  | { readonly mode: "TEXT_ONLY"; readonly reason: null }
  | {
      readonly mode: "VISION_ELIGIBLE";
      readonly reason: "LAYOUT_HEAVY_TEXT" | "TEXT_ENCODING_DEGRADED";
    }
  | { readonly mode: "OCR_REQUIRED"; readonly reason: "INSUFFICIENT_TEXT" };

export interface VisionPageSource {
  getPageImage(documentId: string, pageNumber: number): Promise<ModelImageInput>;
}

export function assessVisionFallback(
  page: ExtractionPageInput
): VisionFallbackDecision {
  if (hasInsufficientPageText(page.textContent)) {
    return { mode: "OCR_REQUIRED", reason: "INSUFFICIENT_TEXT" };
  }
  const replacementCharacters = page.textContent.match(/\uFFFD/g)?.length ?? 0;
  if (replacementCharacters / page.textContent.length > 0.02) {
    return { mode: "VISION_ELIGIBLE", reason: "TEXT_ENCODING_DEGRADED" };
  }
  const nonEmptyLines = page.textContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const shortLines = nonEmptyLines.filter((line) => line.length <= 32);
  if (nonEmptyLines.length >= 10 && shortLines.length / nonEmptyLines.length >= 0.7) {
    return { mode: "VISION_ELIGIBLE", reason: "LAYOUT_HEAVY_TEXT" };
  }
  return { mode: "TEXT_ONLY", reason: null };
}

export async function loadEligibleVisionImages(
  documentId: string,
  pages: readonly ExtractionPageInput[],
  source: VisionPageSource | null
): Promise<ModelImageInput[]> {
  if (source === null) {
    return [];
  }
  const eligible = pages.filter(
    (page) => assessVisionFallback(page).mode === "VISION_ELIGIBLE"
  );
  return Promise.all(
    eligible.map((page) => source.getPageImage(documentId, page.pageNumber))
  );
}
