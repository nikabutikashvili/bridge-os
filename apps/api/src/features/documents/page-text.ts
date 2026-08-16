export const INSUFFICIENT_PAGE_TEXT_COMPACT_CHARS = 40;

export type PageTextSource = "PDF_TEXT" | "OCR";

export function compactPageText(text: string): string {
  return text.replace(/\s/g, "");
}

export function hasInsufficientPageText(text: string): boolean {
  return compactPageText(text).length < INSUFFICIENT_PAGE_TEXT_COMPACT_CHARS;
}

export function pageTextSource(
  source: PageTextSource | undefined
): PageTextSource {
  return source ?? "PDF_TEXT";
}
