export type WorkPackageListView = "drafts" | "queue";

export function parseWorkPackageView(
  value: string | string[] | undefined
): WorkPackageListView {
  const scalar = Array.isArray(value) ? value[0] : value;
  return scalar === "queue" ? "queue" : "drafts";
}

export function workPackageListHref(view: WorkPackageListView): string {
  return view === "queue" ? "/work-packages?view=queue" : "/work-packages";
}
