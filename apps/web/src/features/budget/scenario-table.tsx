"use client";

import type {
  BudgetScenarioItem,
  PlanningPriorityLevel
} from "@bridge-os/contracts";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { InflationAdjustedEstimate, StatusBadge } from "../../components/ui/data-display";
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
import { readScenarioResponse, useScenarioSession } from "./scenario-session";

export function ScenarioTable(): React.ReactElement {
  const { scenario } = useScenarioSession();
  if (scenario === null) {
    throw new Error("ScenarioTable requires an active scenario.");
  }
  const rows = scenario.data;
  const scenarioId = scenario.scenario.id;
  const years = scenario.scenario.years;
  if (rows.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <EmptyState
          compact
          description="Plan interventions first. This scenario will pick them up as candidates."
          title="No planned interventions"
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>Scenario assignments across the planning horizon</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[7.5rem]">Year</TableHead>
            <TableHead className="w-[7.5rem]">Pri</TableHead>
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="min-w-[14rem]">Work</TableHead>
            <TableHead className="w-[7.5rem]">Urgency</TableHead>
            <TableHead className="w-[9.5rem] text-right">Estimate</TableHead>
            <TableHead className="w-[7rem]">Live</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <ScenarioRow
              item={item}
              key={item.intervention.id}
              scenarioId={scenarioId}
              years={years}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ScenarioRow({
  item,
  scenarioId,
  years
}: {
  readonly item: BudgetScenarioItem;
  readonly scenarioId: string;
  readonly years: readonly number[];
}): React.ReactElement {
  const router = useRouter();
  const { applyScenario } = useScenarioSession();
  const [assignedYear, setAssignedYear] = useState(yearValue(item.assignedYear));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(
    () => setAssignedYear(yearValue(item.assignedYear)),
    [item.assignedYear]
  );

  function updateAssignment(next: string): void {
    const previous = assignedYear;
    setAssignedYear(next);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/budget/scenarios/${scenarioId}/assignments/${item.intervention.id}`,
          {
            body: JSON.stringify({
              assignedYear: next === "unassigned" ? null : Number(next)
            }),
            headers: { "content-type": "application/json" },
            method: "PUT"
          }
        );
        applyScenario(await readScenarioResponse(response));
        router.refresh();
      } catch (caught) {
        setAssignedYear(previous);
        setError(caught instanceof Error ? caught.message : "Update failed.");
      }
    });
  }

  const assigned = assignedYear !== "unassigned";

  return (
    <TableRow
      className={cn(assigned ? "shadow-[inset_3px_0_0_var(--foreground)]" : undefined)}
    >
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Select
            disabled={isPending}
            onValueChange={updateAssignment}
            value={assignedYear}
          >
            <SelectTrigger
              aria-label={`Assign ${item.intervention.workType}`}
              className="h-7 w-[6.5rem]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle aria-label={error} className="text-critical" size={14} />
              </TooltipTrigger>
              <TooltipContent>{error}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {assignmentLabel(item)}
        </span>
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
        <strong className="block truncate text-[12px] font-medium leading-5">
          {item.intervention.workType}
        </strong>
        <span className="block text-[11px] text-muted-foreground">
          Live plan {item.intervention.plannedYear}
        </span>
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
      <TableCell className="text-right">
        {item.estimate === null ? (
          <span className="font-mono text-[11px] text-warning">Required</span>
        ) : (
          <span className="block font-mono tabular-nums">
            {formatCurrency(item.estimate.amount, item.estimate.currency)}
          </span>
        )}
        <InflationAdjustedEstimate
          adjustment={item.sourceRecommendation.inflationAdjustedEstimate}
        />
      </TableCell>
      <TableCell>
        <StatusBadge tone={item.liveIncluded ? "info" : "neutral"}>
          {item.liveIncluded ? "In programme" : "Not in"}
        </StatusBadge>
      </TableCell>
    </TableRow>
  );
}

function yearValue(year: number | null): string {
  return year === null ? "unassigned" : String(year);
}

function assignmentLabel(item: BudgetScenarioItem): string {
  if (item.assignmentSource === "USER_OVERRIDE") return "Override";
  if (item.assignmentSource === "AUTO_FILL") return "Auto-fill";
  if (item.assignmentSource === "SEEDED") return "From plan";
  return "Unplaced";
}

function reasonSummary(item: BudgetScenarioItem): string {
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

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLocaleLowerCase("en-US");
}
