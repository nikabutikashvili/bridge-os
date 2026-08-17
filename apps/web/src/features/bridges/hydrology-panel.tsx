import type { BridgeDetailResponse, FloodHistoryEvent } from "@bridge-os/contracts";
import Link from "next/link";

import { StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import { SectionHeader } from "../../components/ui/headings";
import { cn } from "@/lib/utils";
import { formatGermanDate } from "../../lib/formatters";
import {
  floodBandLabel,
  floodBandTone,
  hydrologicalSourceLabel,
  hydrologicalWaterStateLabel
} from "./detail-labels";

interface HydrologyPanelProps {
  readonly bridgeId: string;
  readonly hydrology: BridgeDetailResponse["data"]["hydrology"];
}

export function HydrologyPanel({
  bridgeId,
  hydrology
}: HydrologyPanelProps): React.ReactElement {
  return (
    <section aria-labelledby="hydrology-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        description="Seeded PEGELONLINE gauge joined to inspection history. Bands are a watch, not a probability of failure."
        id="hydrology-heading"
        meta={hydrology?.stationName}
        title="Waterway and flood"
      />
      {hydrology === null ? (
        <div className="border border-border-strong bg-card">
          <EmptyState
            compact
            description="No seeded federal gauge is attached. PEGELONLINE covers Bundeswasserstraßen, not local valley streams."
            title="Hydrology not available"
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <HydrologyStrip hydrology={hydrology} />
          {hydrology.assessment.recommendedAction ? (
            <p className="m-0 border-l-[3px] border-l-warning bg-card px-4 py-3 text-[13px] leading-5">
              {hydrology.assessment.recommendedAction.summary}
            </p>
          ) : null}
          <AssessmentCard hydrology={hydrology} />
          <FloodTimeline bridgeId={bridgeId} events={hydrology.assessment.history} />
        </div>
      )}
    </section>
  );
}

function HydrologyStrip({
  hydrology
}: {
  readonly hydrology: NonNullable<BridgeDetailResponse["data"]["hydrology"]>;
}): React.ReactElement {
  return (
    <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <HydroFact label="Gauge" value={hydrology.stationName} />
      <HydroFact label="Waterway" value={hydrology.waterName} />
      <HydroFact
        label="Current level"
        value={`${String(hydrology.waterLevelCm)} ${hydrology.unit}`}
      />
      <HydroFact
        label="Vs MHW"
        value={
          hydrology.mhwCm === null
            ? null
            : `${hydrology.waterLevelCm >= hydrology.mhwCm ? "+" : ""}${String(hydrology.waterLevelCm - hydrology.mhwCm)} cm`
        }
      />
      <HydroFact
        label="Trigger"
        value={`${String(hydrology.inspectionTriggerCm)} cm`}
      />
      <HydroFact
        label="MNW–MHW"
        value={hydrologicalWaterStateLabel(hydrology.stateMnwMhw)}
      />
    </dl>
  );
}

function AssessmentCard({
  hydrology
}: {
  readonly hydrology: NonNullable<BridgeDetailResponse["data"]["hydrology"]>;
}): React.ReactElement {
  const tone = floodBandTone(hydrology.assessment.band);

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
            {hydrology.distanceKm === null
              ? hydrology.stationName
              : `${hydrology.stationName} · ${hydrology.distanceKm} km`}
          </strong>
          <span className="text-[12px] leading-4 text-muted-foreground">
            {hydrology.assessment.summary}
          </span>
        </div>
        <StatusBadge tone={tone}>{floodBandLabel(hydrology.assessment.band)}</StatusBadge>
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {hydrology.assessment.reasons.map((reason) => (
          <li className="min-w-0 text-[12px] leading-4 text-muted-foreground" key={reason.code}>
            <span className="font-medium text-foreground">{reason.label}</span>
            <span className="block">{reason.detail}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 font-mono text-[11px] leading-4 text-muted-foreground">
        {hydrologicalSourceLabel(hydrology.source)} · {hydrology.formulaVersion}
        {hydrology.sourceDescription ? ` · ${hydrology.sourceDescription}` : ""}
      </p>
    </article>
  );
}

function FloodTimeline({
  bridgeId,
  events
}: {
  readonly bridgeId: string;
  readonly events: readonly FloodHistoryEvent[];
}): React.ReactElement {
  if (events.length === 0) {
    return (
      <div className="border border-border-strong bg-card">
        <EmptyState compact title="No seeded flood years" />
      </div>
    );
  }

  return (
    <div className="border border-border-strong bg-card px-4 py-3">
      <p className="m-0 mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Flood years correlated with inspection history
      </p>
      <ol className="m-0 grid list-none gap-2 p-0">
        {events.map((event) => (
          <li
            className="grid gap-1 border border-border-strong px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-3"
            key={`${String(event.eventYear)}-${event.peakedOn}`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] tabular-nums">{String(event.eventYear)}</span>
              <StatusBadge tone={floodBandTone(event.band)}>
                {floodBandLabel(event.band)}
              </StatusBadge>
            </div>
            <div className="min-w-0 text-[12px] leading-4 text-muted-foreground">
              <span className="font-medium text-foreground">
                {event.stationName} {String(event.peakWaterLevelCm)} cm
              </span>
              <span className="block">{formatGermanDate(event.peakedOn)}</span>
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-1 p-0 text-[12px] leading-4 text-muted-foreground">
              <li>
                {event.specialInspection
                  ? `Sonderprüfung ${formatGermanDate(event.specialInspection.inspectedOn)}`
                  : "No Sonderprüfung"}
              </li>
              <li>
                {event.scourFinding ? (
                  <Link
                    className="bg-muted px-1 py-0.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                    href={`/bridges/${bridgeId}?tab=findings&finding=${event.scourFinding.id}`}
                  >
                    {event.scourFinding.sourceIdentifier ??
                      event.scourFinding.defectType ??
                      "Kolk"}
                  </Link>
                ) : (
                  "No Kolk finding"
                )}
              </li>
              <li>{event.repair?.title ?? "No repair recorded"}</li>
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HydroFact({
  label,
  value
}: {
  readonly label: string;
  readonly value: string | null;
}): React.ReactElement {
  return (
    <div className="min-h-[68px] border border-border-strong bg-card p-3">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-1 text-[13px] leading-5">{value ?? "Not recorded"}</dd>
    </div>
  );
}
