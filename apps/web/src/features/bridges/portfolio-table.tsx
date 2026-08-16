"use client";

import type {
  BridgeAttentionReason,
  BridgePortfolioItem,
  BridgePortfolioQuery
} from "@bridge-os/contracts";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Minus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ConditionBadge,
  StatusBadge,
  SvdChip
} from "../../components/ui/data-display";
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
import { formatGermanDate, formatMeasurement } from "../../lib/formatters";
import { Button } from "@/components/ui/button";
import {
  attentionLabel,
  attentionReasonLabel,
  attentionTone,
  inspectionDueLabel,
  inspectionDueTone,
  inspectionTypeGermanTerm,
  urgencyLabel
} from "./detail-labels";
import { portfolioHref } from "./portfolio-query";

interface PortfolioTableProps {
  readonly pagination: {
    readonly page: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
  readonly query: BridgePortfolioQuery;
  readonly rows: readonly BridgePortfolioItem[];
}

export function PortfolioTable({
  pagination,
  query,
  rows
}: PortfolioTableProps): React.ReactElement {
  return (
    <>
      <Table>
        <TableCaption>Bridges requiring portfolio monitoring attention</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[7rem]">Attn</TableHead>
            <TableHead className="min-w-[16rem]">Object</TableHead>
            <TableHead className="w-14 text-right">Year</TableHead>
            <TableHead className="w-[5.5rem]">Cond</TableHead>
            <TableHead className="w-[8.5rem]">Inspection</TableHead>
            <TableHead className="w-[8.5rem]">S / V / D</TableHead>
            <TableHead className="w-[7.5rem] text-right">ADT</TableHead>
            <TableHead className="min-w-[14rem]">Next action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((bridge) => <PortfolioRow bridge={bridge} key={bridge.id} />)
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-[220px] p-0" colSpan={8}>
                <EmptyState
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/bridges">Reset filters</Link>
                    </Button>
                  }
                  compact
                  description="No structures match the selected road, condition, inspection, finding, urgency, and age criteria."
                  title="Empty object set"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PortfolioPagination pagination={pagination} query={query} />
    </>
  );
}

function PortfolioRow({ bridge }: { readonly bridge: BridgePortfolioItem }): React.ReactElement {
  const router = useRouter();
  const recommendation = bridge.attention.nextRecommendation;
  const actionYear = recommendation?.plannedYear ?? recommendation?.targetYear;
  const bridgeHref = `/bridges/${bridge.id}`;
  const roadContext =
    [bridge.road, bridge.location.municipality].filter(Boolean).join(" · ") ||
    "Network not recorded";

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(bridgeHref)}
    >
      <TableCell>
        <Link
          aria-label={`Open ${bridge.name ?? "bridge"} overview`}
          className="w-fit"
          href={bridgeHref}
          onClick={(event) => event.stopPropagation()}
        >
          <StatusBadge tone={attentionTone(bridge.attention.level)}>
            {attentionLabel(bridge.attention.level)}
          </StatusBadge>
        </Link>
        <span
          className="mt-0.5 block truncate text-[11px] text-muted-foreground"
          title={reasonTitle(bridge.attention.reasons)}
        >
          {shortReason(bridge.attention.reasons)}
        </span>
      </TableCell>
      <TableCell>
        <Link
          className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2"
          href={bridgeHref}
          onClick={(event) => event.stopPropagation()}
        >
          {bridge.name ?? "Unnamed structure"}
        </Link>
        <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
          {bridge.externalStructureNumber ?? "—"}
          <span> · {roadContext}</span>
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
        {bridge.structure.constructionYear ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <ConditionBadge score={bridge.condition.score} />
          <ConditionTrend bridge={bridge} />
        </div>
      </TableCell>
      <TableCell>
        <span className="block font-mono tabular-nums">
          {formatGermanDate(bridge.inspection.latestInspectionOn)}
        </span>
        <StatusBadge
          title={inspectionTypeGermanTerm(bridge.condition.inspectionType)}
          tone={inspectionDueTone(bridge.inspection.status)}
        >
          {inspectionDueLabel(bridge.inspection.status)}
        </StatusBadge>
      </TableCell>
      <TableCell>
        <div className="flex items-baseline gap-2" aria-label={svdLabel(bridge)}>
          <SvdChip
            label="S"
            tone={svdTone(bridge.attention.maximumRatings.stability)}
            value={rating(bridge.attention.maximumRatings.stability)}
          />
          <SvdChip
            label="V"
            tone={svdTone(bridge.attention.maximumRatings.trafficSafety)}
            value={rating(bridge.attention.maximumRatings.trafficSafety)}
          />
          <SvdChip
            label="D"
            tone={svdTone(bridge.attention.maximumRatings.durability)}
            value={rating(bridge.attention.maximumRatings.durability)}
          />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {bridge.attention.openFindings} open
        </span>
      </TableCell>
      <TableCell className="text-right">
        <TrafficCell traffic={bridge.traffic} />
      </TableCell>
      <TableCell>
        {bridge.attention.highestRecommendationUrgency ? (
          <StatusBadge
            srLabel={`${urgencyLabel(bridge.attention.highestRecommendationUrgency)} (${bridge.attention.highestRecommendationUrgency.toUpperCase()})`}
            title={bridge.attention.highestRecommendationUrgency.toUpperCase()}
            tone="warning"
          >
            {urgencyLabel(bridge.attention.highestRecommendationUrgency)}
          </StatusBadge>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            None
          </span>
        )}
        <span
          className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground"
          title={
            recommendation
              ? (recommendation.description ?? "Description not recorded")
              : "No unresolved recommendation"
          }
        >
          {recommendation
            ? (recommendation.description ?? "Description not recorded")
            : "—"}
        </span>
        {actionYear ? (
          <span className="block font-mono text-[11px] tabular-nums text-muted-foreground">
            {actionYear}
          </span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function TrafficCell({
  traffic
}: {
  readonly traffic: BridgePortfolioItem["traffic"];
}): React.ReactElement {
  if (traffic?.dailyTraffic == null) {
    return <span className="font-mono text-muted-foreground">—</span>;
  }
  return (
    <>
      <strong className="block font-mono font-medium tabular-nums">
        {formatMeasurement(traffic.dailyTraffic, "", 0).trim()}
      </strong>
      <span className="block font-mono text-[11px] text-muted-foreground">
        {traffic.observationYear}
        {traffic.truckSharePercent ? ` · ${traffic.truckSharePercent}%` : ""}
      </span>
    </>
  );
}

function ConditionTrend({
  bridge
}: {
  readonly bridge: BridgePortfolioItem;
}): React.ReactElement {
  const trend = bridge.condition.trend;
  const delta = bridge.condition.delta;
  if (trend === "UNKNOWN") {
    return <span className="font-mono text-muted-foreground">—</span>;
  }
  if (trend === "DETERIORATING") {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-critical"
        title={`Worsening${delta ? ` +${delta}` : ""}`}
      >
        <ArrowUpRight aria-hidden="true" size={11} />
        {delta ? `+${delta}` : ""}
      </span>
    );
  }
  if (trend === "IMPROVING") {
    return (
      <span
        className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-success"
        title={`Improving${delta ? ` ${delta}` : ""}`}
      >
        <ArrowDownRight aria-hidden="true" size={11} />
        {delta ?? ""}
      </span>
    );
  }
  return (
    <span className="inline-flex text-muted-foreground" title="Stable">
      <Minus aria-hidden="true" size={11} />
    </span>
  );
}

function PortfolioPagination({
  pagination,
  query
}: Pick<PortfolioTableProps, "pagination" | "query">): React.ReactElement | null {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Portfolio pages"
      className="flex h-8 items-center justify-end gap-3 border-t border-border px-3 font-mono text-[11px] text-muted-foreground"
    >
      <span className="tabular-nums">
        {pagination.page} / {pagination.totalPages}
      </span>
      <div className="flex">
        {pagination.page > 1 ? (
          <Button asChild size="icon-sm" variant="ghost">
            <Link
              aria-label="Previous portfolio page"
              href={portfolioHref(query, { page: pagination.page - 1 })}
              title="Previous page"
            >
              <ArrowLeft aria-hidden="true" size={14} />
            </Link>
          </Button>
        ) : null}
        {pagination.page < pagination.totalPages ? (
          <Button asChild size="icon-sm" variant="ghost">
            <Link
              aria-label="Next portfolio page"
              href={portfolioHref(query, { page: pagination.page + 1 })}
              title="Next page"
            >
              <ArrowRight aria-hidden="true" size={14} />
            </Link>
          </Button>
        ) : null}
      </div>
    </nav>
  );
}

const shortReasonLabels: Record<BridgeAttentionReason, string> = {
  DETERIORATING_CONDITION: "Deteriorating",
  DURABILITY_FINDING: "Durability 2+",
  INSPECTION_DUE_SOON: "Due soon",
  MEDIUM_OR_HIGHER_RECOMMENDATION: "Work open",
  MISSING_CRITICAL_DATA: "Data gap",
  OPEN_FINDING: "Open finding",
  OPEN_RECOMMENDATION: "Open rec",
  OVERDUE_INSPECTION: "Overdue",
  STABILITY_FINDING: "Stability 2+",
  TRAFFIC_SAFETY_FINDING: "Traffic 2+"
};

function reasonTitle(reasons: readonly BridgeAttentionReason[]): string {
  return reasons.length === 0
    ? "No active attention reasons"
    : reasons.map((reason) => attentionReasonLabel(reason)).join("; ");
}

function shortReason(reasons: readonly BridgeAttentionReason[]): string {
  const firstReason = reasons[0];
  if (firstReason === undefined) return "—";
  const first = shortReasonLabels[firstReason];
  return reasons.length === 1 ? first : `${first} +${String(reasons.length - 1)}`;
}

function rating(value: number | null): string {
  return value === null ? "–" : String(value);
}

function svdTone(value: number | null): "critical" | "neutral" | "warning" {
  if (value === null) return "neutral";
  if (value >= 3) return "critical";
  if (value === 2) return "warning";
  return "neutral";
}

function svdLabel(bridge: BridgePortfolioItem): string {
  const ratings = bridge.attention.maximumRatings;
  return `Worst active ratings: stability ${rating(ratings.stability)}, traffic safety ${rating(ratings.trafficSafety)}, durability ${rating(ratings.durability)}`;
}
