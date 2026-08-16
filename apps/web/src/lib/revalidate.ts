import { revalidatePath } from "next/cache";

/**
 * Cross-workspace mutation paths (create work package, plan an intervention,
 * change a budget program) can shift what other views show — a planned
 * recommendation affects portfolio attention, a budget membership change
 * affects planning status, etc. Busting all workspace routes keeps the
 * cached, revalidated reads in src/features/*\/api.ts correct immediately
 * after any mutation, rather than waiting out their revalidate window.
 */
export function revalidateWorkspace(): void {
  revalidatePath("/bridges", "layout");
  revalidatePath("/planning", "layout");
  revalidatePath("/budget", "layout");
  revalidatePath("/work-packages", "layout");
}
