import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BreadcrumbOverride } from "../../../src/components/shell/breadcrumb-context";
import { StatusBadge } from "../../../src/components/ui/data-display";
import { getWorkPackage } from "../../../src/features/work-packages/api";
import { WorkPackageDeleteButton } from "../../../src/features/work-packages/work-package-delete-button";
import { WorkPackageDetail } from "../../../src/features/work-packages/work-package-detail";
import { formatGermanDate } from "../../../src/lib/formatters";

export const metadata: Metadata = { title: "Work package draft" };

export default async function WorkPackagePage({
  params
}: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const response = await getWorkPackage(id);
  if (response === null) notFound();
  const workPackage = response.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbOverride label={workPackage.title} />
      <header className="flex shrink-0 items-start justify-between gap-6 px-4 pt-4">
        <div className="grid min-w-0 gap-1.5">
          <Link
            className="flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground hover:text-foreground"
            href="/work-packages"
          >
            <ArrowLeft aria-hidden="true" size={12} />
            OBJECT SET
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 text-[18px] font-medium leading-6 tracking-tight">
              {workPackage.title}
            </h1>
            <StatusBadge tone={packageStatusTone(workPackage.status)}>
              {packageStatusLabel(workPackage.status)}
            </StatusBadge>
          </div>
          <p className="m-0 font-mono text-[12px] text-muted-foreground">
            Snapshot v{workPackage.snapshotVersion} · generated{" "}
            {formatGermanDate(workPackage.generatedAt)}
          </p>
        </div>
        <WorkPackageDeleteButton
          title={workPackage.title}
          workPackageId={workPackage.id}
        />
      </header>
      <div className="min-w-0 px-4 py-4">
        <WorkPackageDetail workPackage={workPackage} />
      </div>
    </div>
  );
}

function packageStatusLabel(status: "ARCHIVED" | "DRAFT" | "READY_FOR_REVIEW"): string {
  return {
    ARCHIVED: "Archived",
    DRAFT: "Draft",
    READY_FOR_REVIEW: "Ready"
  }[status];
}

function packageStatusTone(
  status: "ARCHIVED" | "DRAFT" | "READY_FOR_REVIEW"
): "info" | "neutral" | "success" {
  if (status === "READY_FOR_REVIEW") return "success";
  if (status === "ARCHIVED") return "neutral";
  return "info";
}
