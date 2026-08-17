import type { BridgeDetailResponse } from "@bridge-os/contracts";

import { StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import { SectionHeader } from "../../components/ui/headings";
import { cn } from "@/lib/utils";
import { formatMeasurement } from "../../lib/formatters";
import {
  networkBandLabel,
  networkBandTone,
  networkRoadClassLabel,
  networkSourceLabel
} from "./detail-labels";

interface NetworkPanelProps {
  readonly network: BridgeDetailResponse["data"]["network"];
}

export function NetworkPanel({ network }: NetworkPanelProps): React.ReactElement {
  return (
    <section aria-labelledby="network-heading" className="grid min-w-0 content-start gap-3">
      <SectionHeader
        description="Closure impact on the carried road. Distances are a seeded OSM snapshot, not a live assignment."
        id="network-heading"
        meta={network ? String(network.observationYear) : undefined}
        title="Network criticality"
      />
      {network === null ? (
        <div className="border border-border-strong bg-card">
          <EmptyState
            compact
            description="No seeded detour or alternative-crossing record is attached to this structure."
            title="Network metrics not available"
          />
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          <NetworkStrip network={network} />
          <AssessmentCard network={network} />
        </div>
      )}
    </section>
  );
}

function NetworkStrip({
  network
}: {
  readonly network: NonNullable<BridgeDetailResponse["data"]["network"]>;
}): React.ReactElement {
  const distances = network.distances;
  const traffic = network.traffic;
  const extraKm = network.assessment.extraVehicleKmPerDay;

  return (
    <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <NetworkFact
        label="Normal trip"
        value={formatKm(distances.normalTripKm)}
      />
      <NetworkFact
        label="Closure detour"
        value={formatKm(distances.closureDetourKm)}
      />
      <NetworkFact
        label="Additional distance"
        value={
          distances.additionalDistanceKm === null
            ? null
            : `+${formatKm(distances.additionalDistanceKm) ?? distances.additionalDistanceKm}`
        }
      />
      <NetworkFact
        label="Alternatives"
        value={
          network.alternativeCrossingCount === null
            ? null
            : String(network.alternativeCrossingCount)
        }
      />
      <NetworkFact
        label="HGV / day"
        value={
          traffic.heavyVehicleDaily === null
            ? null
            : formatMeasurement(traffic.heavyVehicleDaily, "", 0).trim()
        }
      />
      <NetworkFact
        label="Extra veh-km / day"
        value={
          extraKm === null ? null : Math.round(extraKm).toLocaleString("en-US")
        }
      />
    </dl>
  );
}

function AssessmentCard({
  network
}: {
  readonly network: NonNullable<BridgeDetailResponse["data"]["network"]>;
}): React.ReactElement {
  const tone = networkBandTone(network.assessment.band);

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
            {networkRoadClassLabel(network.roadClass)}
            {network.carriedRoad ? ` · ${network.carriedRoad}` : ""}
          </strong>
          <span className="text-[12px] leading-4 text-muted-foreground">
            {network.assessment.summary}
          </span>
        </div>
        <StatusBadge tone={tone}>{networkBandLabel(network.assessment.band)}</StatusBadge>
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {network.assessment.reasons.map((reason) => (
          <li className="min-w-0 text-[12px] leading-4 text-muted-foreground" key={reason.code}>
            <span className="font-medium text-foreground">{reason.label}</span>
            <span className="block">{reason.detail}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 font-mono text-[11px] leading-4 text-muted-foreground">
        {networkSourceLabel(network.source)} · {network.formulaVersion}
        {network.sourceDescription ? ` · ${network.sourceDescription}` : ""}
      </p>
    </article>
  );
}

function NetworkFact({
  label,
  value
}: {
  readonly label: string;
  readonly value: string | number | null;
}): React.ReactElement {
  return (
    <div className="grid min-w-0 gap-1 border border-border-strong bg-card px-3 py-2.5">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 font-mono text-[13px] tabular-nums text-foreground">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function formatKm(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return `${value} km`;
}
