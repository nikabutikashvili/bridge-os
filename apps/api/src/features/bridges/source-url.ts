export function buildDocumentSourceUrl(
  sourceUrl: string | null,
  pageNumber: number | null
): string | null {
  if (sourceUrl === null) {
    return null;
  }
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (pageNumber !== null) {
      url.hash = `page=${String(pageNumber)}`;
    }
    return url.toString();
  } catch {
    return null;
  }
}
