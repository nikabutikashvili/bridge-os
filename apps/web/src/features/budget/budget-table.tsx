"use client";

import type {
  BudgetItem,
  BudgetResponse,
  PlanningPriorityLevel
} from "@bridge-os/contracts";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
import { formatCurrency } from "../../lib/formatters";

interface BudgetTableProps {
  readonly planningYear: number;
  readonly rows: BudgetResponse["data"];
}

export function BudgetTable({
  planningYear,
  rows
}: BudgetTableProps): React.ReactElement {
  if (rows.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <EmptyState
          compact
          description="Create planned interventions for this year before assembling a budget program."
          title="No interventions in this planning year"
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>
          Planned interventions and budget program membership for {planningYear}
        </TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">In</TableHead>
            <TableHead className="w-[7.5rem]">Pri</TableHead>
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="min-w-[14rem]">Work</TableHead>
            <TableHead className="w-[7.5rem]">Urgency</TableHead>
            <TableHead className="w-16 text-right">Year</TableHead>
            <TableHead className="w-[9.5rem] text-right">Estimate</TableHead>
            <TableHead className="w-[9rem]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <BudgetRow
              item={item}
              key={item.intervention.id}
              planningYear={planningYear}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BudgetRow({
  item,
  planningYear
}: {
  readonly item: BudgetItem;
  readonly planningYear: number;
}): React.ReactElement {
  const router = useRouter();
  const [included, setIncluded] = useState(item.included);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setIncluded(item.included), [item.included]);

  function updateMembership(nextIncluded: boolean): void {
    setIncluded(nextIncluded);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/budget/${String(planningYear)}/interventions/${item.intervention.id}`,
          {
            body: JSON.stringify({ included: nextIncluded }),
            headers: { "content-type": "application/json" },
            method: "PUT"
          }
        );
        if (!response.ok) throw await responseError(response);
        router.refresh();
      } catch (caught) {
        setIncluded(!nextIncluded);
        setError(caught instanceof Error ? caught.message : "Update failed.");
      }
    });
  }

  const objectHref = `/bridges/${item.bridge.id}`;

  return (
    <TableRow
      className={cn(
        included ? "shadow-[inset_3px_0_0_var(--foreground)]" : undefined
      )}
    >
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Checkbox
            aria-label={`${included ? "Exclude" : "Include"} ${item.intervention.workType}`}
            checked={included}
            className="rounded-none shadow-none"
            disabled={isPending}
            onCheckedChange={(checked) => updateMembership(checked === true)}
          />
          {error ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle aria-label={error} className="text-critical" size={14} />
              </TooltipTrigger>
              <TooltipContent>{error}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge tone={priorityTone(item.priority.level)}>
          {titleCase(item.priority.level)}
        </StatusBadge>
        <span
          className="mt-0.5 block truncate text-[11px] text-muted-foreground"
          title={item.priority.reasons.map((reason) => reason.detail).join("; ")}
        >
          {reasonSummary(item)}
        </span>
      </TableCell>
      <TableCell>
        <Link
          className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2"
          href={objectHref}
        >
          {item.bridge.name ?? "Unnamed structure"}
        </Link>
        <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {item.bridge.externalStructureNumber ?? "—"}
          {item.bridge.road ? ` · ${item.bridge.road}` : ""}
        </span>
      </TableCell>
      <TableCell>
        <strong className="block truncate text-[12px] font-medium leading-5">
          {item.intervention.workType}
        </strong>
        <span className="block text-[11px] text-muted-foreground">Managerial plan</span>
      </TableCell>
      <TableCell>
        {item.sourceRecommendation.urgency ? (
          <StatusBadge
            srLabel={`${urgencyLabel(item.sourceRecommendation.urgency)} (${item.sourceRecommendation.urgency.toUpperCase()})`}
            title={item.sourceRecommendation.urgency.toUpperCase()}
            tone="warning"
          >
            {urgencyLabel(item.sourceRecommendation.urgency)}
          </StatusBadge>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            None
          </span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        <strong className="block font-medium">{item.intervention.plannedYear}</strong>
        <span className="block text-[11px] text-muted-foreground">
          Src {item.sourceRecommendation.targetYear ?? "—"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {item.estimate === null ? (
          <span className="font-mono text-[11px] text-warning">Required</span>
        ) : (
          <span className="block font-mono tabular-nums">
            {formatCurrency(item.estimate.amount, item.estimate.currency)}
          </span>
        )}
        <span className="block truncate text-[11px] text-muted-foreground">
          {estimateBasis(item)}
        </span>
        {sourceComparison(item)}
      </TableCell>
      <TableCell>
        <StatusBadge tone={statusTone(item.intervention.status)}>
          {statusLabel(item.intervention.status)}
        </StatusBadge>
      </TableCell>
    </TableRow>
  );
}

function estimateBasis(item: BudgetItem): string {
  if (item.estimate === null) {
    return "Missing";
  }
  const labels = {
    SOURCE_DOCUMENT: "Bauwerksbuch",
    EXTERNAL_ENRICHED: "External",
    USER_PLANNING: "User plan"
  } as const;
  const status =
    item.estimate.status === null ? "source fact" : titleCase(item.estimate.status);
  return `${labels[item.estimate.source]} · ${status}`;
}

function sourceComparison(item: BudgetItem): React.ReactElement | null {
  const source = item.sourceRecommendation.sourceEstimatedCost;
  if (source === null || item.estimate?.source === "SOURCE_DOCUMENT") return null;
  return (
    <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
      Src {formatCurrency(source.amount, source.currency)}
    </span>
  );
}

function reasonSummary(item: BudgetItem): string {
  const first = item.priority.reasons[0];
  if (first === undefined) return "No active reason";
  return item.priority.reasons.length === 1
    ? first.label
    : `${first.label} +${String(item.priority.reasons.length - 1)}`;
}

function priorityTone(
  level: PlanningPriorityLevel
): "critical" | "neutral" | "warning" {
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH" || level === "MEDIUM") return "warning";
  return "neutral";
}

function urgencyLabel(value: string): string {
  const labels: Record<string, string> = {
    SOFORT: "Immediate",
    KURZFRISTIG: "Short term",
    MITTELFRISTIG: "Medium term",
    LANGFRISTIG: "Long term"
  };
  return labels[value.toUpperCase()] ?? value;
}

function statusLabel(value: BudgetItem["intervention"]["status"]): string {
  const labels = {
    PLANNED: "Planned",
    BUDGETED: "Budgeted",
    TENDER_PREPARATION: "Tender preparation",
    TENDERED_READY: "Tendered / ready",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed"
  } as const;
  return labels[value];
}

function statusTone(
  value: BudgetItem["intervention"]["status"]
): "info" | "neutral" | "success" | "warning" {
  if (value === "COMPLETED") return "success";
  if (value === "IN_PROGRESS" || value === "TENDER_PREPARATION") return "warning";
  if (value === "BUDGETED" || value === "TENDERED_READY") return "info";
  return "neutral";
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase("en-US");
}

async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new Error(
    payload?.error?.message ?? `Request failed (${String(response.status)}).`
  );
}
