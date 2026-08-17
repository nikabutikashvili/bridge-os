import type {
  BridgeDetailResponse,
  DamageMechanismAssessment
} from "@bridge-os/contracts";
import Link from "next/link";

import { StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import { SectionHeader } from "../../components/ui/headings";
import { cn } from "@/lib/utils";
import { formatMeasurement, formatPercentage } from "../../lib/formatters";
import {
  damageMechanismBandLabel,
  damageMechanismBandTone,
  damageMechanismKindLabel
} from "./detail-labels";

interface EnvironmentPanelProps {
  readonly bridgeId: string;
  readonly environment: BridgeDetailResponse["data"]["environment"];
}

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
] as const;

export function EnvironmentPanel({
  bridgeId,
  environment
}: EnvironmentPanelProps): React.ReactElement {
  return (
    <section aria-labelledby="environment-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        description="Seeded ERA5-land climate joined to inspection findings. Bands are a watch, not a probability of failure."
        id="environment-heading"
        meta={environment ? String(environment.observationYear) : undefined}
        title="Climate and damage mechanisms"
      />
      {environment === null ? (
        <div className="border border-border-strong bg-card">
          <EmptyState
            compact
            description="No seeded climate record is attached to this structure."
            title="Climate metrics not available"
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <ClimateStrip environment={environment} />
          <MonthlyPrecip months={environment.monthly} year={environment.observationYear} />
          <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {environment.mechanisms.map((mechanism) => (
              <li key={mechanism.kind}>
                <MechanismCard bridgeId={bridgeId} mechanism={mechanism} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function ClimateStrip({
  environment
}: {
  readonly environment: NonNullable<BridgeDetailResponse["data"]["environment"]>;
}): React.ReactElement {
  const previous = environment.previousYear;
  const metrics = environment.metrics;

  return (
    <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <ClimateFact
        label="Freeze / thaw"
        value={formatCount(metrics.freezeThawDays, "days")}
        {...optionalDetail(
          vsPrevious(metrics.freezeThawDays, previous?.freezeThawDays, previous?.observationYear)
        )}
      />
      <ClimateFact
        label="Heavy rain ≥ 20 mm"
        value={formatCount(metrics.heavyRainDays20, "days")}
        {...optionalDetail(
          vsPrevious(
            metrics.heavyRainDays20,
            previous?.heavyRainDays20,
            previous?.observationYear
          )
        )}
      />
      <ClimateFact
        label="De-icing days"
        value={formatCount(metrics.deicingDays, "days")}
      />
      <ClimateFact
        label="Mean RH"
        value={formatPercentage(metrics.meanRelativeHumidityPercent)}
      />
      <ClimateFact
        label="Annual precip"
        value={
          metrics.annualPrecipMm === null
            ? null
            : formatMeasurement(metrics.annualPrecipMm, "mm", 1)
        }
        {...optionalDetail(
          previous?.annualPrecipMm === null || previous?.annualPrecipMm === undefined
            ? undefined
            : `vs ${String(previous.observationYear)}: ${formatMeasurement(previous.annualPrecipMm, "mm", 1)}`
        )}
      />
      <ClimateFact
        label="Source"
        value="Open-Meteo"
        {...optionalDetail(environment.sourceDescription ?? environment.formulaVersion)}
      />
    </dl>
  );
}

function MonthlyPrecip({
  months,
  year
}: {
  readonly months: NonNullable<BridgeDetailResponse["data"]["environment"]>["monthly"];
  readonly year: number;
}): React.ReactElement {
  if (months.length !== 12) {
    return (
      <div className="border border-border-strong bg-card">
        <EmptyState compact title="Monthly precipitation not recorded" />
      </div>
    );
  }

  const peak = Math.max(
    ...months.map((month) => Number(month.precipMm)),
    1
  );

  return (
    <div className="border border-border-strong bg-card px-4 py-3">
      <p className="m-0 mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Monthly precipitation {String(year)}
      </p>
      <ol className="m-0 grid h-[92px] list-none grid-cols-12 items-end gap-1 p-0">
        {months.map((month) => {
          const precip = Number(month.precipMm);
          const height = Math.max(4, Math.round((precip / peak) * 72));
          return (
            <li className="grid min-w-0 justify-items-center gap-1" key={month.month}>
              <span
                className={cn(
                  "w-full max-w-6 bg-foreground/80",
                  month.freezeThawDays > 0 && "outline outline-1 outline-offset-[-1px] outline-border-strong"
                )}
                style={{ height }}
                title={`${monthLabels[month.month - 1] ?? String(month.month)}: ${formatMeasurement(month.precipMm, "mm", 1)}${
                  month.freezeThawDays > 0
                    ? ` · ${String(month.freezeThawDays)} freeze/thaw days`
                    : ""
                }`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {monthLabels[month.month - 1] ?? String(month.month)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MechanismCard({
  bridgeId,
  mechanism
}: {
  readonly bridgeId: string;
  readonly mechanism: DamageMechanismAssessment;
}): React.ReactElement {
  const tone = damageMechanismBandTone(mechanism.band);

  return (
    <article
      className={cn(
        "grid min-w-0 gap-2.5 border border-border-strong bg-card px-4 py-3",
        tone === "warning" && "border-l-[3px] border-l-warning",
        tone === "info" && "border-l-[3px] border-l-info"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <strong className="text-[13px] font-medium leading-5">
            {damageMechanismKindLabel(mechanism.kind)}
          </strong>
          <span className="text-[12px] leading-4 text-muted-foreground">{mechanism.summary}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={tone}>{damageMechanismBandLabel(mechanism.band)}</StatusBadge>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {mechanism.confidence.toLowerCase()} confidence
          </span>
        </div>
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {mechanism.reasons.slice(0, 4).map((reason) => (
          <li className="min-w-0 text-[12px] leading-4 text-muted-foreground" key={reason.code}>
            <span className="font-medium text-foreground">{reason.label}</span>
            <span className="block">{reason.detail}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] leading-4 text-muted-foreground">
        <span className="font-medium text-foreground">Linked findings</span>
        {mechanism.linkedFindings.length === 0 ? (
          <span>No linked finding</span>
        ) : (
          mechanism.linkedFindings.map((finding) => (
            <Link
              className="bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
              href={`/bridges/${bridgeId}?tab=findings&finding=${finding.id}`}
              key={finding.id}
            >
              {finding.sourceIdentifier ?? finding.defectType ?? "Finding"}
            </Link>
          ))
        )}
      </div>
    </article>
  );
}

function ClimateFact({
  detail,
  label,
  value
}: {
  readonly detail?: string;
  readonly label: string;
  readonly value: string | null;
}): React.ReactElement {
  return (
    <div className="min-h-[68px] border border-border-strong bg-card p-3">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-1 text-[13px] leading-5">{value ?? "Not recorded"}</dd>
      {detail ? (
        <dd className="m-0 mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground" title={detail}>
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function formatCount(value: number | null, unit: string): string | null {
  return value === null ? null : formatMeasurement(value, unit, 0);
}

function vsPrevious(
  current: number | null,
  previous: number | null | undefined,
  previousYear: number | null | undefined
): string | undefined {
  if (current === null || previous === null || previous === undefined || previousYear === undefined) {
    return undefined;
  }
  return `vs ${String(previousYear)}: ${formatMeasurement(previous, "days", 0)}`;
}

function optionalDetail(detail: string | undefined): { readonly detail: string } | Record<string, never> {
  return detail === undefined ? {} : { detail };
}
