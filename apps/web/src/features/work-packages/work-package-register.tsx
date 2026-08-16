import type { WorkPackageListResponse } from "@bridge-os/contracts";
import { ClipboardCheck, PackageOpen } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../../components/ui/table";
import {
  formatCurrency,
  formatGermanDate,
  formatMeasurement
} from "../../lib/formatters";
import { WorkPackageCreateButton } from "./work-package-create-button";

type PackageSummary = WorkPackageListResponse["data"][number];
type EligibleIntervention =
  WorkPackageListResponse["eligibleInterventions"][number];

export function WorkPackageDraftTable({
  packages
}: {
  readonly packages: readonly PackageSummary[];
}): React.ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>Generated planning draft work packages</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[16rem]">Package</TableHead>
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="min-w-[12rem]">Work</TableHead>
            <TableHead className="w-16 text-right">Year</TableHead>
            <TableHead className="w-[8.5rem]">Ready</TableHead>
            <TableHead className="w-[9rem]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages.length > 0 ? (
            packages.map((item) => <PackageRow item={item} key={item.id} />)
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-[220px] p-0" colSpan={6}>
                <EmptyState
                  compact
                  description="Create a planning draft from an approved maintenance intervention in the creation queue."
                  icon={<PackageOpen size={20} strokeWidth={1.6} />}
                  title="No draft work packages yet"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function EligibleInterventionsTable({
  interventions
}: {
  readonly interventions: readonly EligibleIntervention[];
}): React.ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>Planned interventions eligible for work package creation</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="min-w-[14rem]">Work</TableHead>
            <TableHead className="w-16 text-right">Year</TableHead>
            <TableHead className="w-[9.5rem] text-right">Estimate</TableHead>
            <TableHead className="w-[9rem]">Status</TableHead>
            <TableHead className="w-[5.5rem]"><span className="sr-only">Create</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {interventions.length > 0 ? (
            interventions.map((item) => (
              <CandidateRow item={item} key={item.id} />
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-[220px] p-0" colSpan={6}>
                <EmptyState
                  compact
                  description="All active planned interventions have a draft, or no interventions have been planned yet."
                  icon={<ClipboardCheck size={20} strokeWidth={1.6} />}
                  title="No interventions awaiting preparation"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PackageRow({ item }: { readonly item: PackageSummary }): React.ReactElement {
  const issues = item.readiness.missing + item.readiness.required;
  return (
    <TableRow>
      <TableCell>
        <Link
          className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2"
          href={`/work-packages/${item.id}`}
        >
          {item.title}
        </Link>
        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
          Snapshot v{item.snapshotVersion} · {formatGermanDate(item.generatedAt)}
        </span>
      </TableCell>
      <TableCell>
        <Link
          className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2"
          href={`/bridges/${item.bridge.id}`}
        >
          {item.bridge.name ?? "Unnamed structure"}
        </Link>
        <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {item.bridge.externalStructureNumber ?? "—"}
          {item.bridge.road ? ` · ${item.bridge.road}` : ""}
        </span>
      </TableCell>
      <TableCell>
        <span className="block truncate text-[12px]">{item.workType}</span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {item.plannedYear}
      </TableCell>
      <TableCell>
        <span className="block font-mono tabular-nums">
          {item.readiness.available}/{item.readiness.total}
        </span>
        <span
          className={
            issues === 0
              ? "block text-[11px] text-muted-foreground"
              : "block text-[11px] text-warning"
          }
        >
          {issues === 0 ? "No recorded gaps" : `${String(issues)} review items`}
        </span>
      </TableCell>
      <TableCell>
        <StatusBadge tone={packageStatusTone(item.status)}>
          {statusLabel(item.status)}
        </StatusBadge>
      </TableCell>
    </TableRow>
  );
}

function CandidateRow({ item }: { readonly item: EligibleIntervention }): React.ReactElement {
  return (
    <TableRow>
      <TableCell>
        <Link
          className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2"
          href={`/bridges/${item.bridge.id}`}
        >
          {item.bridge.name ?? "Unnamed structure"}
        </Link>
        <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {item.bridge.externalStructureNumber ?? "—"}
          {item.bridge.road ? ` · ${item.bridge.road}` : ""}
        </span>
      </TableCell>
      <TableCell>
        <strong className="block truncate text-[12px] font-medium">{item.workType}</strong>
        <span className="block text-[11px] text-muted-foreground">
          {item.quantity
            ? formatMeasurement(item.quantity.value, item.quantity.unit)
            : "Qty not recorded"}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {item.plannedYear}
      </TableCell>
      <TableCell className="text-right">
        {item.planningEstimate ? (
          <>
            <span className="block font-mono tabular-nums">
              {formatCurrency(item.planningEstimate.amount, item.planningEstimate.currency)}
            </span>
            <span className="block text-[11px] text-muted-foreground">
              {estimateSourceLabel(item.estimateSource)}
            </span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-warning">Required</span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge tone="neutral">{planStatusLabel(item.status)}</StatusBadge>
      </TableCell>
      <TableCell>
        <WorkPackageCreateButton
          interventionId={item.id}
          workType={item.workType}
        />
      </TableCell>
    </TableRow>
  );
}

function statusLabel(value: PackageSummary["status"]): string {
  return {
    DRAFT: "Draft",
    READY_FOR_REVIEW: "Ready",
    ARCHIVED: "Archived"
  }[value];
}

function packageStatusTone(
  value: PackageSummary["status"]
): "info" | "neutral" | "success" {
  if (value === "READY_FOR_REVIEW") return "success";
  if (value === "ARCHIVED") return "neutral";
  return "info";
}

function planStatusLabel(value: EligibleIntervention["status"]): string {
  return {
    PLANNED: "Planned",
    BUDGETED: "Budgeted",
    TENDER_PREPARATION: "Tender preparation",
    TENDERED_READY: "Tendered / ready",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed"
  }[value];
}

function estimateSourceLabel(value: EligibleIntervention["estimateSource"]): string {
  if (value === "USER_PLANNING") return "User plan";
  if (value === "EXTERNAL_ENRICHED") return "External";
  return "Source not recorded";
}
