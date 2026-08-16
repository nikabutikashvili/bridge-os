import type {
  BridgeDataHealth,
  BridgeDataHealthIndicator,
  DocumentOverviewResponse
} from "@bridge-os/contracts";
import Link from "next/link";

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

export function DataHealthTable({
  bridges
}: {
  readonly bridges: DocumentOverviewResponse["bridgeDataHealth"];
}): React.ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>Deterministic bridge data health indicators</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="min-w-[16rem]">Current records</TableHead>
            <TableHead className="min-w-[16rem]">Extraction / evidence</TableHead>
            <TableHead className="min-w-[16rem]">Planning / supporting</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bridges.length > 0 ? (
            bridges.map((health) => <DataHealthRow health={health} key={health.bridge.id} />)
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-[220px] p-0" colSpan={4}>
                <EmptyState
                  compact
                  description="Bridge records are required before data-quality checks can run."
                  title="No bridge data to assess"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DataHealthRow({ health }: { readonly health: BridgeDataHealth }): React.ReactElement {
  return (
    <TableRow className={health.attentionCount > 0 ? "shadow-[inset_3px_0_0_var(--warning)]" : undefined}>
      <TableCell className="align-top">
        <Link className="block min-w-0" href={`/bridges/${health.bridge.id}`}>
          <span className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2">
            {health.bridge.name ?? "Unnamed structure"}
          </span>
          <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
            {health.bridge.externalStructureNumber ?? "—"}
            {health.bridge.road ? ` · ${health.bridge.road}` : ""}
          </span>
        </Link>
        <div className="mt-1">
          <StatusBadge tone={health.attentionCount > 0 ? "warning" : "success"}>
            {health.attentionCount > 0
              ? `${String(health.attentionCount)} flags`
              : "Clear"}
          </StatusBadge>
        </div>
      </TableCell>
      <TableCell className="align-top">
        <HealthGroup
          indicators={[
            findIndicator(health, "LATEST_INSPECTION"),
            findIndicator(health, "TRAFFIC_CURRENCY"),
            findIndicator(health, "GEOMETRY_COMPLETENESS")
          ]}
        />
      </TableCell>
      <TableCell className="align-top">
        <HealthGroup
          indicators={[
            findIndicator(health, "EXTRACTION_ERRORS"),
            findIndicator(health, "EXTRACTED_FINDING_REVIEW"),
            findIndicator(health, "CRITICAL_SOURCE_EVIDENCE")
          ]}
        />
      </TableCell>
      <TableCell className="align-top">
        <HealthGroup
          indicators={[
            findIndicator(health, "RECOMMENDATION_QUANTITIES"),
            findIndicator(health, "RECOMMENDATION_COST_ESTIMATES"),
            findIndicator(health, "LOAD_RECALCULATION_DOCUMENT")
          ]}
        />
      </TableCell>
    </TableRow>
  );
}

function HealthGroup({
  indicators
}: {
  readonly indicators: readonly BridgeDataHealthIndicator[];
}): React.ReactElement {
  return (
    <div className="grid gap-2">
      {indicators.map((indicator) => (
        <HealthCheck indicator={indicator} key={indicator.code} />
      ))}
    </div>
  );
}

function HealthCheck({
  indicator
}: {
  readonly indicator: BridgeDataHealthIndicator;
}): React.ReactElement {
  const positive = ["AVAILABLE", "CURRENT", "COMPLETE"].includes(indicator.status);
  const tone = positive ? "ok" : indicator.status === "ERROR" ? "critical" : "warning";
  return (
    <div className="grid grid-cols-[6px_minmax(0,1fr)] items-start gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-1.5",
          tone === "ok" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "critical" && "bg-critical"
        )}
      />
      <div className="grid min-w-0 gap-px">
        <strong className="text-[12px] font-medium leading-4">{indicator.label}</strong>
        <span className="text-[11px] leading-4 text-muted-foreground">{indicator.detail}</span>
      </div>
    </div>
  );
}

function findIndicator(
  health: BridgeDataHealth,
  code: BridgeDataHealthIndicator["code"]
): BridgeDataHealthIndicator {
  const indicator = health.indicators.find((item) => item.code === code);
  if (indicator === undefined) throw new Error(`Missing data health indicator ${code}`);
  return indicator;
}
