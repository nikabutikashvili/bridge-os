"use client";

import type { BridgeInspectionsResponse } from "@bridge-os/contracts";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { ChartContainer, type ChartConfig } from "../../components/ui/chart";
import { conditionScoreTone } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import { formatConditionScore, formatGermanDate } from "../../lib/formatters";
import { buildConditionSeries } from "./detail-model";
import { inspectionTypeLabel } from "./detail-labels";

interface ConditionHistoryChartProps {
  readonly inspections: BridgeInspectionsResponse["data"];
}

type InspectionType = BridgeInspectionsResponse["data"][number]["type"];

interface ConditionDatum {
  readonly date: string;
  readonly id: string;
  readonly inspectionType: InspectionType;
  readonly label: string;
  readonly score: number;
}

const chartConfig: ChartConfig = {
  score: {
    color: "var(--foreground)",
    label: "Condition score"
  }
};

const scoreFill: Record<"critical" | "info" | "success" | "warning", string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  critical: "var(--critical)"
};

const conditionBands = [
  { fill: "var(--success)", from: 1, label: "1.0–1.9 good", to: 1.9 },
  { fill: "var(--info)", from: 1.9, label: "1.9–2.4 fair", to: 2.4 },
  { fill: "var(--warning)", from: 2.4, label: "2.4–2.9 poor", to: 2.9 },
  { fill: "var(--critical)", from: 2.9, label: "2.9–4.0 severe", to: 4 }
] as const;

export function ConditionHistoryChart({
  inspections
}: ConditionHistoryChartProps): React.ReactElement {
  const series = buildConditionSeries(inspections);

  if (series.length === 0) {
    return (
      <div className="border border-border-strong bg-card">
        <EmptyState
          compact
          description="No inspection has both a source date and condition score."
          title="Condition history not available"
        />
      </div>
    );
  }

  const data: ConditionDatum[] = series.map((point) => ({
    date: point.date,
    id: point.id,
    inspectionType: point.inspectionType,
    label: monthYear(point.date),
    score: point.score
  }));

  return (
    <div className="border border-border-strong bg-card px-4 pb-3 pt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 font-mono text-[11px] text-muted-foreground">
          Discrete inspections · step holds until the next recorded score · Y reversed
        </p>
        <ol className="m-0 flex list-none flex-wrap items-center gap-3 p-0">
          {conditionBands.map((band) => (
            <li
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
              key={band.label}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0"
                style={{ background: band.fill }}
              />
              {band.label}
            </li>
          ))}
        </ol>
      </div>
      <ChartContainer className="h-[260px]" config={chartConfig}>
        <ComposedChart data={data} margin={{ bottom: 4, left: 0, right: 8, top: 8 }}>
          {conditionBands.map((band) => (
            <ReferenceArea
              fill={band.fill}
              fillOpacity={0.08}
              ifOverflow="hidden"
              key={band.label}
              y1={band.from}
              y2={band.to}
            />
          ))}
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval="preserveStartEnd"
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontFamily: "var(--font-geist-mono)", fontSize: 10 }}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            axisLine={false}
            domain={[1, 4]}
            reversed
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontFamily: "var(--font-geist-mono)", fontSize: 10 }}
            tickFormatter={(value: number) => value.toFixed(1)}
            tickLine={false}
            ticks={[1, 2, 3, 4]}
            width={34}
          />
          <Tooltip
            content={(tooltipProps) => (
              <ConditionTooltip
                active={tooltipProps.active}
                point={tooltipProps.payload?.[0]?.payload as ConditionDatum | undefined}
              />
            )}
            cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.18, strokeWidth: 1 }}
          />
          <Line
            activeDot={false}
            dataKey="score"
            dot={<ConditionDot />}
            isAnimationActive={false}
            stroke="var(--foreground)"
            strokeWidth={1.25}
            type="stepAfter"
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function ConditionDot({
  cx,
  cy,
  payload
}: {
  readonly cx?: number;
  readonly cy?: number;
  readonly payload?: ConditionDatum;
}): React.ReactElement | null {
  if (cx === undefined || cy === undefined || payload === undefined) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      fill={scoreFill[conditionScoreTone(payload.score)]}
      r={4}
      stroke="var(--card)"
      strokeWidth={1.5}
    />
  );
}

function ConditionTooltip({
  active,
  point
}: {
  readonly active?: boolean | undefined;
  readonly point?: ConditionDatum | undefined;
}): React.ReactElement | null {
  if (!active || !point) {
    return null;
  }

  const tone = conditionScoreTone(point.score);

  return (
    <div className="grid gap-0.5 border border-border-strong bg-card px-2.5 py-2">
      <strong className="font-mono text-[11px] font-medium tabular-nums text-foreground">
        {formatGermanDate(point.date)}
      </strong>
      <span className="text-[11px] text-muted-foreground">
        {inspectionTypeLabel(point.inspectionType)}
      </span>
      <span
        className="font-mono text-[18px] font-medium tabular-nums leading-none"
        style={{ color: scoreFill[tone] }}
      >
        {formatConditionScore(point.score)}
      </span>
    </div>
  );
}

function monthYear(date: string): string {
  const [year, month] = date.split("-");
  return year && month ? `${month}.${year}` : date;
}
