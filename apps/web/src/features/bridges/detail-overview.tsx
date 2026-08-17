import type {
  BridgeDetailResponse,
  BridgeHistoryResponse,
  BridgeInspectionsResponse,
  BridgeRecommendationsResponse
} from "@bridge-os/contracts";
import { Gauge, Wrench } from "lucide-react";
import Link from "next/link";

import { ConditionBadge, StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import { SectionHeader } from "../../components/ui/headings";
import { Timeline, TimelineItem } from "../../components/ui/timeline";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatGermanDate,
  formatMeasurement,
  formatPercentage
} from "../../lib/formatters";
import { ConditionHistoryChart } from "./condition-history-chart";
import { currentRecommendations, relevantTimelineEvents } from "./detail-model";
import { EnvironmentPanel } from "./environment-panel";
import {
  inspectionTypeGermanTerm,
  inspectionTypeLabel,
  ratingLabel,
  ratingTone,
  recordStatusLabel,
  recordStatusTone,
  trafficSourceLabel,
  trafficSourceTitle,
  trafficSourceTone,
  urgencyGermanTerm,
  urgencyLabel
} from "./detail-labels";
import { EvidenceList } from "./evidence-list";

interface DetailOverviewProps {
  readonly bridge: BridgeDetailResponse["data"];
  readonly history: BridgeHistoryResponse["data"];
  readonly inspections: BridgeInspectionsResponse["data"];
  readonly recommendations: BridgeRecommendationsResponse["data"];
}

export function DetailOverview({
  bridge,
  history,
  inspections,
  recommendations
}: DetailOverviewProps): React.ReactElement {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <section aria-labelledby="condition-history-heading" className="grid min-w-0 content-start gap-3">
          <SectionHeader
            description="Fixed 1.0–4.0 scale. Lower scores represent better condition."
            id="condition-history-heading"
            meta={`${String(inspections.length)} inspections`}
            title="Condition history"
          />
          <ConditionHistoryChart inspections={inspections} />
        </section>
        <CurrentSvd bridge={bridge} />
      </div>

      <EnvironmentPanel bridgeId={bridge.id} environment={bridge.environment} />

      <CurrentActions
        bridgeId={bridge.id}
        recommendations={recommendations}
      />

      <AssetContext bridge={bridge} />
      <AssetTimeline bridgeId={bridge.id} history={history} />
    </div>
  );
}

function CurrentSvd({
  bridge
}: {
  readonly bridge: BridgeDetailResponse["data"];
}): React.ReactElement {
  const ratings = bridge.attention.maximumRatings;
  const values = [
    {
      code: "S",
      label: "Standsicherheit",
      sublabel: "Structural safety",
      value: ratings.stability
    },
    {
      code: "V",
      label: "Verkehrssicherheit",
      sublabel: "Traffic safety",
      value: ratings.trafficSafety
    },
    {
      code: "D",
      label: "Dauerhaftigkeit",
      sublabel: "Durability",
      value: ratings.durability
    }
  ] as const;

  return (
    <section aria-labelledby="svd-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        description="Worst value among open or monitored findings."
        id="svd-heading"
        title="Current S / V / D"
      />
      <div className="grid gap-3">
        {values.map((rating) => {
          const tone = ratingTone(rating.value);
          const signal = tone === "warning" || tone === "critical" ? tone : "ok";
          return (
            <dl
              className={cn(
                "m-0 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border border-border-strong bg-card px-4 py-3",
                signal === "critical" && "border-l-[3px] border-l-critical",
                signal === "warning" && "border-l-[3px] border-l-warning"
              )}
              key={rating.code}
            >
              <div className="min-w-0">
                <dt className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center bg-muted font-mono text-[11px] font-medium text-muted-foreground">
                    {rating.code}
                  </span>
                  <span className="grid min-w-0">
                    <strong className="font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
                      {rating.label}
                    </strong>
                    <small className="text-[11px] leading-4 text-muted-foreground">
                      {rating.sublabel}
                    </small>
                  </span>
                </dt>
              </div>
              <dd className="m-0 grid justify-items-end gap-0.5">
                <span
                  className={cn(
                    "font-mono text-[28px] font-medium leading-none tabular-nums",
                    svdValueClasses[tone]
                  )}
                >
                  {rating.value ?? "–"}
                </span>
                <span className="text-[11px] leading-4 text-muted-foreground">
                  {ratingLabel(rating.value)}
                </span>
              </dd>
            </dl>
          );
        })}
      </div>
    </section>
  );
}

const svdValueClasses: Record<"critical" | "info" | "neutral" | "success" | "warning", string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  critical: "text-critical",
  neutral: "text-muted-foreground"
};

function CurrentActions({
  bridgeId,
  recommendations
}: {
  readonly bridgeId: string;
  readonly recommendations: BridgeRecommendationsResponse["data"];
}): React.ReactElement {
  const active = currentRecommendations(recommendations);

  return (
    <section aria-labelledby="actions-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        id="actions-heading"
        meta={`${String(active.length)} unresolved`}
        title="Current actions"
      />
      {active.length === 0 ? (
        <div className="border border-border-strong bg-card">
          <EmptyState
            compact
            description="There are no recommendations in an active workflow state."
            title="No current actions"
          />
        </div>
      ) : (
        <ol className="m-0 max-h-[420px] list-none overflow-y-auto border border-border-strong bg-card p-0">
          {active.map((recommendation) => {
            const urgencyTerm = urgencyGermanTerm(recommendation.urgency);
            return (
              <li
                className="grid gap-2 px-4 py-3 [&+&]:border-t [&+&]:border-border"
                key={recommendation.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="text-[13px] font-medium leading-5">
                      {recommendation.description ?? "Description not recorded"}
                    </strong>
                    <span className="text-[12px] leading-4 text-muted-foreground">
                      {recommendation.workType ?? "Work type not recorded"}
                    </span>
                  </div>
                  <StatusBadge
                    srLabel={
                      urgencyTerm
                        ? `${urgencyLabel(recommendation.urgency)} (${urgencyTerm})`
                        : undefined
                    }
                    title={urgencyTerm}
                    tone="warning"
                  >
                    {urgencyLabel(recommendation.urgency)}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] leading-4 text-muted-foreground">
                  <StatusBadge tone={recordStatusTone(recommendation.status)}>
                    {recordStatusLabel(recommendation.status)}
                  </StatusBadge>
                  <span>{formatQuantity(recommendation.quantity)}</span>
                  <span>
                    Planned / target {recommendation.plannedYear ?? recommendation.targetYear ?? "not recorded"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] leading-4 text-muted-foreground">
                  <span className="font-medium text-foreground">Linked findings</span>
                  {recommendation.linkedFindings.length === 0 ? (
                    <span>No linked finding</span>
                  ) : (
                    recommendation.linkedFindings.map((finding) => (
                      <Link
                        className="bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                        href={`/bridges/${bridgeId}?tab=findings&finding=${finding.id}`}
                        key={finding.id}
                        title={finding.description ?? undefined}
                      >
                        {finding.sourceIdentifier ?? finding.defectType ?? "Finding"}
                      </Link>
                    ))
                  )}
                </div>
                <EvidenceList
                  bridgeId={bridgeId}
                  citations={recommendation.evidence}
                  limit={1}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function AssetContext({
  bridge
}: {
  readonly bridge: BridgeDetailResponse["data"];
}): React.ReactElement {
  const structure = bridge.partialStructures[0];
  const traffic = bridge.latestTraffic;

  return (
    <section aria-labelledby="asset-context-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader id="asset-context-heading" title="Asset context" />
      <dl className="m-0 grid grid-cols-5 border border-border-strong bg-card">
        <ContextFact label="Construction year" value={structure?.constructionYear} />
        <ContextFact label="Structure type" value={structure?.structureType} />
        <ContextFact label="Structural system" value={structure?.structuralSystem} />
        <ContextFact label="Length" value={formatMeasurement(structure?.geometry.lengthM, "m")} />
        <ContextFact label="Width" value={formatMeasurement(structure?.geometry.widthM, "m")} />
        <ContextFact label="Area" value={formatMeasurement(structure?.geometry.areaSqM, "m²")} />
        <ContextFact label="Spans" value={structure?.geometry.spanCount} />
        <ContextFact
          label="Traffic"
          value={
            traffic?.dailyTraffic === null || traffic?.dailyTraffic === undefined
              ? null
              : formatMeasurement(traffic.dailyTraffic, "vehicles/day", 0)
          }
          {...(traffic
            ? {
                detail: `Observation ${String(traffic.observationYear)} · ${trafficSourceLabel(traffic.source)}`,
                detailTitle: trafficSourceTitle(traffic.source)
              }
            : {})}
        />
        <ContextFact
          label="Truck share"
          value={formatPercentage(traffic?.truckSharePercent)}
        />
        <ContextFact label="Responsible authority" value={bridge.responsibility.responsibleAuthority} />
      </dl>
    </section>
  );
}

function AssetTimeline({
  bridgeId,
  history
}: {
  readonly bridgeId: string;
  readonly history: BridgeHistoryResponse["data"];
}): React.ReactElement {
  const events = relevantTimelineEvents(history);
  return (
    <section aria-labelledby="timeline-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        description="Inspections and recorded construction or maintenance work in reverse chronological order."
        id="timeline-heading"
        title="Asset timeline"
      />
      {events.length === 0 ? (
        <div className="border border-border-strong bg-card">
          <EmptyState compact title="No dated inspection or work history" />
        </div>
      ) : (
        <div className="border border-border-strong bg-card px-4 pt-3.5">
          <Timeline label="Bridge inspection and work history">
            {events.map((event) => (
              <TimelineItem
                date={formatGermanDate(event.date)}
                key={`${event.kind}-${event.id}`}
                meta={
                  event.kind === "INSPECTION" ? (
                    <ConditionBadge score={event.conditionScore} />
                  ) : event.kind === "TRAFFIC_OBSERVATION" ? (
                    <StatusBadge title={trafficSourceTitle(event.source)} tone={trafficSourceTone(event.source)}>
                      {trafficSourceLabel(event.source)}
                    </StatusBadge>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em]">
                      <Wrench size={12} /> Work
                    </span>
                  )
                }
                title={event.title}
              >
                <div className="inline-flex items-center gap-1.5">
                  <span
                    title={
                      event.kind === "INSPECTION"
                        ? inspectionTypeGermanTerm(event.inspectionType)
                        : undefined
                    }
                  >
                    {event.kind === "INSPECTION"
                      ? inspectionTypeLabel(event.inspectionType)
                      : event.kind === "TRAFFIC_OBSERVATION"
                        ? (
                            <span className="inline-flex items-center gap-1">
                              <Gauge size={12} />
                              {event.dailyTraffic === null
                                ? "Traffic volume not recorded"
                                : `${formatMeasurement(event.dailyTraffic, "vehicles/day", 0)}${
                                    event.truckSharePercent
                                      ? ` · ${event.truckSharePercent}% trucks`
                                      : ""
                                  }`}
                            </span>
                          )
                        : (event.reason ?? event.workType ?? "Work context not recorded")}
                  </span>
                </div>
                {event.kind === "HISTORICAL_WORK" ? (
                  <div>
                    {formatQuantity(event.quantity)}
                    {event.finalAmount
                      ? ` · final ${formatCurrency(event.finalAmount.amount, event.finalAmount.currency)}`
                      : ""}
                  </div>
                ) : null}
                <EvidenceList bridgeId={bridgeId} citations={event.evidence} limit={1} />
              </TimelineItem>
            ))}
          </Timeline>
        </div>
      )}
    </section>
  );
}

function ContextFact({
  detail,
  detailTitle,
  label,
  value
}: {
  readonly detail?: string;
  readonly detailTitle?: string;
  readonly label: string;
  readonly value: number | string | null | undefined;
}): React.ReactElement {
  return (
    <div className="min-h-[68px] border-l border-border p-3 [&:nth-child(5n+1)]:border-l-0 [&:nth-child(n+6)]:border-t">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-1 text-[13px] leading-5">{value ?? "Not recorded"}</dd>
      {detail ? (
        <dd className="m-0 mt-0.5 text-[11px] leading-4 text-muted-foreground" title={detailTitle}>
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function formatQuantity(
  quantity: { readonly unit: string; readonly value: string } | null
): string {
  return quantity === null
    ? "Quantity not recorded"
    : formatMeasurement(quantity.value, quantity.unit);
}
