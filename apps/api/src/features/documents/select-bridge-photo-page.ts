import { compactPageText } from "./page-text.js";

export const BRIDGE_PHOTO_PAGE_SCAN_LIMIT = 20;
export const BRIDGE_PHOTO_MIN_SCORE = 5;

const PHOTO_LABEL =
  /\bfotos?\b|lichtbild(?:er)?|photographie|photograph(?:ie|en)?/i;
const STRUCTURE_VIEW =
  /bauwerksansicht|ansicht des bauwerks|gesamtansicht|ansicht der br[uü]cke/i;
const WEAK_VIEW = /\bansicht\b/i;
const DRAWING =
  /querschnitt|l[aä]ngsschnitt|grundriss|lageplan|bewehrung|regelquerschnitt|konstruktionszeichnung|schnitt\s+[a-zäöü]/i;
const BOOK_COVER = /bauwerksbuch/i;

export interface BridgePhotoPageCandidate {
  readonly pageNumber: number;
  readonly textContent: string;
  readonly textSource?: "PDF_TEXT" | "OCR";
}

export function selectBridgePhotoPage(
  pages: readonly BridgePhotoPageCandidate[]
): number | null {
  let best: { pageNumber: number; score: number } | null = null;

  for (const page of pages) {
    if (page.pageNumber > BRIDGE_PHOTO_PAGE_SCAN_LIMIT) {
      continue;
    }
    const score = scoreBridgePhotoPage(page);
    if (score < BRIDGE_PHOTO_MIN_SCORE) {
      continue;
    }
    if (
      best === null ||
      score > best.score ||
      (score === best.score && page.pageNumber < best.pageNumber)
    ) {
      best = { pageNumber: page.pageNumber, score };
    }
  }

  return best?.pageNumber ?? null;
}

export function scoreBridgePhotoPage(page: BridgePhotoPageCandidate): number {
  const compact = compactPageText(page.textContent);
  const drawing = DRAWING.test(page.textContent);
  let score = 0;

  if (PHOTO_LABEL.test(page.textContent)) {
    score += 12;
  }
  if (STRUCTURE_VIEW.test(page.textContent)) {
    score += 10;
  } else if (WEAK_VIEW.test(page.textContent) && !drawing) {
    score += 5;
  }
  if (
    page.pageNumber <= 12 &&
    compact.length >= 15 &&
    compact.length <= 220 &&
    !drawing
  ) {
    score += 4;
  }
  if (page.pageNumber === 1 && compact.length <= 350) {
    score += 2;
  }
  if (
    page.textSource === "OCR" &&
    page.pageNumber <= 8 &&
    compact.length <= 200 &&
    !drawing
  ) {
    score += 6;
  }
  if (BOOK_COVER.test(page.textContent) && !PHOTO_LABEL.test(page.textContent)) {
    score -= 4;
  }
  if (drawing) {
    score -= 15;
  }

  return score;
}
