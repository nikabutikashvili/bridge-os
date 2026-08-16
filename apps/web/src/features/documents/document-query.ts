export type DocumentListView = "register" | "health";

export function parseDocumentView(
  value: string | string[] | undefined
): DocumentListView {
  const scalar = Array.isArray(value) ? value[0] : value;
  return scalar === "health" ? "health" : "register";
}

export function documentListHref(view: DocumentListView): string {
  return view === "health" ? "/documents?view=health" : "/documents";
}
