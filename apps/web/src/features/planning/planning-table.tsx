"use client";

import type {
  CreatePlannedIntervention,
  PlannedInterventionStatus,
  PlanningItem,
  PlanningPriorityLevel,
  PlanningResponse,
  PlanningView
} from "@bridge-os/contracts";
import { ArrowLeft, ArrowRight, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { StatusBadge } from "../../components/ui/data-display";
import { DetailPanel } from "../../components/ui/detail-panel";
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
import { formatCurrency, formatMeasurement } from "../../lib/formatters";
import { planningHref } from "./planning-query";

interface PlanningTableProps {
  readonly pagination: PlanningResponse["pagination"];
  readonly rows: readonly PlanningItem[];
  readonly view: PlanningView;
}

export function PlanningTable({
  pagination,
  rows,
  view
}: PlanningTableProps): React.ReactElement {
  const [selected, setSelected] = useState<PlanningItem | null>(null);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableCaption>Maintenance planning work queue</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[7.5rem]">Pri</TableHead>
              <TableHead className="min-w-[14rem]">Object</TableHead>
              <TableHead className="min-w-[16rem]">Work</TableHead>
              <TableHead className="w-[7.5rem]">Urgency</TableHead>
              <TableHead className="w-16 text-right">Year</TableHead>
              <TableHead className="w-[8.5rem] text-right">Cost</TableHead>
              <TableHead className="w-[9.5rem]">Status</TableHead>
              <TableHead className="w-[4.5rem]"><span className="sr-only">Plan</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((item) => (
                <PlanningRow
                  item={item}
                  key={item.recommendationId}
                  onPlan={() => setSelected(item)}
                />
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell className="h-[220px] p-0" colSpan={8}>
                  <EmptyState
                    compact
                    description="No recommendations or interventions are currently in this lifecycle state."
                    title="No work in this view"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <PlanningPagination pagination={pagination} view={view} />
      <PlanInterventionPanel item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function PlanningRow({
  item,
  onPlan
}: {
  readonly item: PlanningItem;
  readonly onPlan: () => void;
}): React.ReactElement {
  const plan = item.plannedIntervention;
  const recommendation = item.sourceRecommendation;
  const quantity = plan?.quantity ?? recommendation.quantity;
  const estimatedCost = plan?.estimatedCost ?? recommendation.sourceEstimatedCost;
  const year = plan?.plannedYear ?? recommendation.targetYear;
  const objectHref = `/bridges/${item.bridge.id}`;

  return (
    <TableRow>
      <TableCell>
        <StatusBadge tone={priorityTone(item.priority.level)}>
          {priorityLabel(item.priority.level)}
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
          {plan?.workType ?? recommendation.workType ?? "Work type not recorded"}
        </strong>
        <span
          className="line-clamp-1 block text-[11px] text-muted-foreground"
          title={recommendation.description ?? "Description not recorded"}
        >
          {recommendation.description ?? "Description not recorded"}
        </span>
        <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
          {item.linkedFindings.length === 0
            ? "No linked findings"
            : `${String(item.linkedFindings.length)} findings`}
        </span>
      </TableCell>
      <TableCell>
        {recommendation.urgency ? (
          <StatusBadge
            srLabel={`${urgencyLabel(recommendation.urgency)} (${recommendation.urgency.toUpperCase()})`}
            title={recommendation.urgency.toUpperCase()}
            tone="warning"
          >
            {urgencyLabel(recommendation.urgency)}
          </StatusBadge>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            None
          </span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        <strong className="block font-medium">{year ?? "—"}</strong>
        <span className="block text-[11px] text-muted-foreground">
          {plan ? "Plan" : "Source"}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className="block font-mono tabular-nums">{formatMoney(estimatedCost)}</span>
        <span className="block text-[11px] text-muted-foreground">
          {formatQuantity(quantity)}
        </span>
      </TableCell>
      <TableCell>
        <StatusBadge tone={statusTone(plan?.status)}>
          {statusLabel(plan?.status)}
        </StatusBadge>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {plan ? "Managerial plan" : "Source rec"}
        </span>
      </TableCell>
      <TableCell>
        {plan === null ? (
          <Button
            aria-label={`Plan ${recommendation.workType ?? "recommendation"}`}
            onClick={onPlan}
            size="sm"
            title="Create planned intervention"
            variant="outline"
          >
            Plan
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function PlanInterventionPanel({
  item,
  onClose
}: {
  readonly item: PlanningItem | null;
  readonly onClose: () => void;
}): React.ReactElement | null {
  return (
    <DetailPanel
      eyebrow="Managerial decision"
      onClose={onClose}
      open={item !== null}
      title="Create planned intervention"
    >
      {item ? <PlanInterventionForm item={item} onCreated={onClose} /> : null}
    </DetailPanel>
  );
}

function PlanInterventionForm({
  item,
  onCreated
}: {
  readonly item: PlanningItem;
  readonly onCreated: () => void;
}): React.ReactElement {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const recommendation = item.sourceRecommendation;

  function submit(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>
  ): void {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const workType = stringValue(form, "workType");
    const plannedYear = stringValue(form, "plannedYear");
    const quantityValue = stringValue(form, "quantityValue");
    const quantityUnit = stringValue(form, "quantityUnit");
    const estimatedCost = stringValue(form, "estimatedCost");
    if (workType === null || plannedYear === null) {
      setError("Work type and planned year are required.");
      return;
    }
    if ((quantityValue === null) !== (quantityUnit === null)) {
      setError("Quantity and unit must be entered together.");
      return;
    }

    const input: CreatePlannedIntervention = {
      recommendationId: item.recommendationId,
      workType,
      plannedYear: Number(plannedYear),
      quantity:
        quantityValue === null || quantityUnit === null
          ? null
          : { value: quantityValue, unit: quantityUnit },
      estimatedCost:
        estimatedCost === null
          ? null
          : { amount: estimatedCost, currency: "EUR" }
    };

    startTransition(async () => {
      try {
        const response = await fetch("/api/planning/interventions", {
          body: JSON.stringify(input),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(
            payload?.error?.message ??
              `Request failed (${String(response.status)}).`
          );
        }
        onCreated();
        router.push(planningHref("planned"));
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to create intervention."
        );
      }
    });
  }

  return (
    <div className="grid gap-5">
      <section className="-mx-[18px] grid border-b border-border">
        <div className="grid gap-0.5 px-[18px] py-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Bridge
          </span>
          <strong className="text-[13px] font-medium leading-5">
            {item.bridge.name ?? "Unnamed structure"}
          </strong>
          <small className="font-mono text-[11px] text-muted-foreground">
            {item.bridge.externalStructureNumber ?? "No structure number"} · {item.bridge.road ?? "Road not recorded"}
          </small>
        </div>
        <div className="grid gap-0.5 border-t border-border px-[18px] py-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Source recommendation
          </span>
          <strong className="text-[13px] font-medium leading-5">
            {recommendation.workType ?? "Work type not recorded"}
          </strong>
          <small className="text-[12px] leading-4 text-muted-foreground">
            {recommendation.description ?? "Description not recorded"}
          </small>
        </div>
      </section>

      <section className="grid gap-2.5">
        <h3 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
          Why it needs attention
        </h3>
        <ul className="m-0 list-none border-y border-border p-0">
          {item.priority.reasons.map((reason) => (
            <li
              className="grid grid-cols-[66px_minmax(0,1fr)] items-start gap-2.5 py-2.5 [&+&]:border-t [&+&]:border-border"
              key={reason.code}
            >
              <StatusBadge tone={priorityTone(reason.severity)}>
                {priorityLabel(reason.severity)}
              </StatusBadge>
              <div className="grid gap-px">
                <strong className="text-[12px] font-medium leading-4">{reason.label}</strong>
                <span className="text-[12px] leading-4 text-muted-foreground">{reason.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form className="grid gap-3" onSubmit={submit}>
        <fieldset className="grid grid-cols-2 gap-2.5 border-0 p-0 disabled:cursor-wait disabled:opacity-65" disabled={isPending}>
          <legend className="col-span-full m-0 mb-2 p-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
            Planned scope
          </legend>
          <div className="col-span-full grid gap-1">
            <Label htmlFor="workType">Intervention / work type</Label>
            <Input
              defaultValue={recommendation.workType ?? ""}
              id="workType"
              maxLength={200}
              name="workType"
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="plannedYear">Planned year</Label>
            <Input
              defaultValue={recommendation.targetYear ?? new Date().getUTCFullYear()}
              id="plannedYear"
              max="2200"
              min="1700"
              name="plannedYear"
              required
              type="number"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="quantityValue">Quantity</Label>
            <Input
              defaultValue={recommendation.quantity?.value ?? ""}
              id="quantityValue"
              min="0"
              name="quantityValue"
              step="0.001"
              type="number"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="quantityUnit">Unit</Label>
            <Input
              defaultValue={recommendation.quantity?.unit ?? ""}
              id="quantityUnit"
              maxLength={50}
              name="quantityUnit"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="estimatedCost">Estimated cost (EUR)</Label>
            <Input
              defaultValue={recommendation.sourceEstimatedCost?.amount ?? ""}
              id="estimatedCost"
              min="0"
              name="estimatedCost"
              step="0.01"
              type="number"
            />
          </div>
        </fieldset>
        <p className="m-0 text-[12px] leading-4 text-muted-foreground">
          Source values are prefilled for review. Saving creates a separate managerial record and does not alter the recommendation.
        </p>
        {error ? (
          <p className="m-0 border-l-[3px] border-l-critical bg-critical-bg px-2.5 py-2 text-[12px] leading-4 text-critical" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button disabled={isPending} onClick={onCreated} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isPending} type="submit">
            <CalendarPlus aria-hidden="true" size={14} />
            {isPending ? "Creating…" : "Create intervention"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PlanningPagination({
  pagination,
  view
}: Pick<PlanningTableProps, "pagination" | "view">): React.ReactElement | null {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Planning pages"
      className="flex h-8 shrink-0 items-center justify-end gap-3 border-t border-border px-3 font-mono text-[11px] text-muted-foreground"
    >
      <span className="tabular-nums">
        {pagination.page} / {pagination.totalPages}
      </span>
      <div className="flex">
        {pagination.page > 1 ? (
          <Button asChild size="icon-sm" variant="ghost">
            <Link href={planningHref(view, pagination.page - 1)} title="Previous page">
              <ArrowLeft aria-hidden="true" size={14} />
            </Link>
          </Button>
        ) : null}
        {pagination.page < pagination.totalPages ? (
          <Button asChild size="icon-sm" variant="ghost">
            <Link href={planningHref(view, pagination.page + 1)} title="Next page">
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

function priorityTone(level: PlanningPriorityLevel): "critical" | "neutral" | "warning" {
  if (level === "CRITICAL") return "critical";
  if (level === "HIGH" || level === "MEDIUM") return "warning";
  return "neutral";
}

function priorityLabel(level: PlanningPriorityLevel): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

function reasonSummary(item: PlanningItem): string {
  const first = item.priority.reasons[0];
  if (first === undefined) return "No active priority reason";
  return item.priority.reasons.length === 1
    ? first.label
    : `${first.label} +${String(item.priority.reasons.length - 1)}`;
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

function statusLabel(status: PlannedInterventionStatus | undefined): string {
  const labels: Record<PlannedInterventionStatus, string> = {
    PLANNED: "Planned",
    BUDGETED: "Budgeted",
    TENDER_PREPARATION: "Tender preparation",
    TENDERED_READY: "Tendered / ready",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed"
  };
  return status === undefined ? "Unplanned" : labels[status];
}

function statusTone(
  status: PlannedInterventionStatus | undefined
): "info" | "neutral" | "success" | "warning" {
  if (status === "COMPLETED") return "success";
  if (status === "IN_PROGRESS" || status === "TENDERED_READY") return "info";
  if (status === "BUDGETED" || status === "TENDER_PREPARATION") return "warning";
  return "neutral";
}

function formatQuantity(
  quantity: { readonly unit: string; readonly value: string } | null
): string {
  return quantity === null
    ? "Qty not recorded"
    : formatMeasurement(quantity.value, quantity.unit);
}

function formatMoney(
  value: { readonly amount: string; readonly currency: string } | null
): string {
  return value === null
    ? "—"
    : formatCurrency(value.amount, value.currency);
}

function stringValue(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
