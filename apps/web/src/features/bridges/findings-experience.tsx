"use client";

import type { BridgeFinding, BridgeFindingsResponse } from "@bridge-os/contracts";
import { Eye, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StatusBadge, SvdChip } from "../../components/ui/data-display";
import { DetailPanel } from "../../components/ui/detail-panel";
import { EmptyState } from "../../components/ui/feedback";
import { SectionHeader } from "../../components/ui/headings";
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
import {
  inspectionTypeGermanTerm,
  inspectionTypeLabel,
  ratingLabel,
  recordStatusLabel,
  recordStatusTone,
  urgencyGermanTerm,
  urgencyLabel
} from "./detail-labels";
import { EvidenceSources, FieldProvenanceBadge } from "./evidence-sources";

interface FindingsExperienceProps {
  readonly bridgeId: string;
  readonly data: BridgeFindingsResponse["data"];
  readonly selectedFinding: BridgeFinding | null;
}

export function FindingsExperience({
  bridgeId,
  data,
  selectedFinding
}: FindingsExperienceProps): React.ReactElement {
  const router = useRouter();
  const closePanel = useCallback((): void => {
    router.replace(`/bridges/${bridgeId}?tab=findings`, { scroll: false });
  }, [bridgeId, router]);

  return (
    <>
      <section aria-labelledby="findings-heading" className="grid min-h-[300px] min-w-0 content-start gap-3">
        <SectionHeader
          description="Inspection findings with component, severity, action, and evidence context."
          id="findings-heading"
          meta={`${String(data.length)} records`}
          title="Findings"
        />
        {data.length === 0 ? (
          <EmptyState compact title="No findings recorded" />
        ) : (
          <div className="overflow-hidden border border-border-strong bg-card">
            <Table className="min-w-[1570px] table-fixed">
              <TableCaption>Bridge findings</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[150px]">Finding</TableHead>
                  <TableHead className="w-[220px]">Component / defect</TableHead>
                  <TableHead className="w-[300px]">Description / location</TableHead>
                  <TableHead className="w-[180px]">Extent / quantity</TableHead>
                  <TableHead className="w-[120px]">S / V / D</TableHead>
                  <TableHead className="w-[150px]">Inspection</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[290px]">Linked recommendation</TableHead>
                  <TableHead className="w-[50px]"><span className="sr-only">Review finding</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((finding) => {
                  const selected = finding.id === selectedFinding?.id;
                  return (
                    <TableRow
                      className={cn(
                        "hover:bg-row-hover",
                        selected ? "bg-accent shadow-[inset_3px_0_0_var(--primary)] hover:bg-accent" : undefined
                      )}
                      key={finding.id}
                    >
                      <TableCell className="align-top">
                        <Link
                          className="mb-0.5 block font-mono text-[12px] font-medium text-foreground hover:underline hover:underline-offset-2"
                          href={findingHref(bridgeId, finding.id)}
                          scroll={false}
                        >
                          {finding.sourceIdentifier ?? "Identifier not recorded"}
                        </Link>
                        <span className="block text-[10px] leading-[15px] text-muted-foreground">
                          {finding.partialStructure.externalNumber === null
                            ? "Partial structure not recorded"
                            : `Teilbauwerk ${finding.partialStructure.externalNumber}`}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <strong className="block text-xs font-semibold leading-[17px]">
                          {finding.component?.name ?? "Component not recorded"}
                        </strong>
                        <span className="block text-[10px] leading-[15px] text-muted-foreground">
                          {finding.defectType ?? "Defect type not recorded"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="line-clamp-2 block text-xs leading-[17px]">
                          {finding.description ?? "Description not recorded"}
                        </span>
                        <span className="line-clamp-2 block text-[10px] leading-[15px] text-muted-foreground">
                          {finding.location ?? "Location not recorded"}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="block text-xs leading-[17px]">
                          {finding.extent ?? "Extent not recorded"}
                        </span>
                        <span className="block text-[10px] leading-[15px] text-muted-foreground">
                          {formatQuantity(finding.quantity)}
                        </span>
                      </TableCell>
                      <TableCell className="align-top"><SvdValues ratings={finding.ratings} /></TableCell>
                      <TableCell className="align-top">
                        <span className="block text-xs leading-[17px]">
                          {formatGermanDate(finding.inspection.inspectedOn)}
                        </span>
                        <span
                          className="block text-[10px] leading-[15px] text-muted-foreground"
                          title={inspectionTypeGermanTerm(finding.inspection.type)}
                        >
                          {inspectionTypeLabel(finding.inspection.type)}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={recordStatusTone(finding.status)}>
                          {recordStatusLabel(finding.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="align-top"><LinkedRecommendationSummary finding={finding} /></TableCell>
                      <TableCell className="!px-1.5 text-center align-top">
                        <Button asChild size="icon-sm" variant="ghost">
                          <Link
                            aria-label={`Review ${finding.sourceIdentifier ?? "finding"}`}
                            href={findingHref(bridgeId, finding.id)}
                            scroll={false}
                            title="Review finding and evidence"
                          >
                            <Eye aria-hidden="true" size={16} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <FindingDetailPanel
        bridgeId={bridgeId}
        finding={selectedFinding}
        onClose={closePanel}
      />
    </>
  );
}

function FindingDetailPanel({
  bridgeId,
  finding,
  onClose
}: {
  readonly bridgeId: string;
  readonly finding: BridgeFinding | null;
  readonly onClose: () => void;
}): React.ReactElement | null {
  if (finding === null) {
    return null;
  }

  return (
    <DetailPanel
      eyebrow={finding.sourceIdentifier ?? "Finding"}
      onClose={onClose}
      open
      title={finding.defectType ?? "Finding detail"}
    >
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border py-2.5 text-[11px] text-muted-foreground">
        <StatusBadge tone={recordStatusTone(finding.status)}>
          {recordStatusLabel(finding.status)}
        </StatusBadge>
        <span>{formatGermanDate(finding.inspection.inspectedOn)}</span>
        <span title={inspectionTypeGermanTerm(finding.inspection.type)}>
          {inspectionTypeLabel(finding.inspection.type)}
        </span>
      </div>

      <section
        aria-labelledby="normalized-finding-heading"
        className="grid gap-3 border-b border-border py-5"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(160px,0.8fr)] items-start gap-1.5">
          <div>
            <p className="m-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Normalized record
            </p>
            <h3 className="m-0 text-sm leading-5" id="normalized-finding-heading">
              Structured interpretation
            </h3>
          </div>
          <p className="m-0 text-[10px] leading-[15px] text-muted-foreground">
            Structured values are not source quotations. Field badges show their provenance.
          </p>
        </div>

        <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["sourceIdentifier"]}
            label="Finding identifier"
            value={finding.sourceIdentifier}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["componentId"]}
            label="Component"
            value={componentLabel(finding)}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["description"]}
            label="Description"
            value={finding.description}
            wide
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["defectType"]}
            label="Defect type"
            value={finding.defectType}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["location"]}
            label="Location"
            value={finding.location}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["extent"]}
            label="Extent"
            value={finding.extent}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["quantity", "quantityUnit"]}
            label="Quantity"
            value={formatQuantity(finding.quantity)}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={[
              "dimensionLength",
              "dimensionWidth",
              "dimensionDepth",
              "dimensionUnit"
            ]}
            label="Dimensions"
            value={formatDimensions(finding)}
          />
          <NormalizedField
            citations={finding.evidence}
            fieldNames={["partialStructureId"]}
            label="Partial structure"
            value={
              finding.partialStructure.name ??
              finding.partialStructure.externalNumber
            }
          />
        </dl>

        <div className="grid grid-cols-3">
          <RatingDetail
            citations={finding.evidence}
            fieldName="stabilityRating"
            label="Standsicherheit"
            shortLabel="S"
            value={finding.ratings.stability}
          />
          <RatingDetail
            citations={finding.evidence}
            fieldName="trafficSafetyRating"
            label="Verkehrssicherheit"
            shortLabel="V"
            value={finding.ratings.trafficSafety}
          />
          <RatingDetail
            citations={finding.evidence}
            fieldName="durabilityRating"
            label="Dauerhaftigkeit"
            shortLabel="D"
            value={finding.ratings.durability}
          />
        </div>
      </section>

      <section aria-labelledby="finding-actions-heading" className="grid gap-3 border-b border-border py-5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="m-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Action context
            </p>
            <h3 className="m-0 text-sm leading-5" id="finding-actions-heading">
              Linked recommendations
            </h3>
          </div>
          <span className="text-[10px] leading-[15px] text-muted-foreground">
            {String(finding.linkedRecommendations.length)}
          </span>
        </div>
        {finding.linkedRecommendations.length === 0 ? (
          <p className="m-0 text-[10px] not-italic leading-[15px] text-muted-foreground">
            No recommendation is linked to this finding.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {finding.linkedRecommendations.map((recommendation) => (
              <li
                className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 border-t border-border py-2.5 first:border-t-0 last:border-b"
                key={recommendation.id}
              >
                <Wrench aria-hidden="true" className="mt-0.5 text-muted-foreground" size={15} />
                <div>
                  <strong className="text-[11px] leading-4">
                    {recommendation.workType ?? "Work type not recorded"}
                  </strong>
                  <p className="my-0.5 text-[11px] leading-4">
                    {recommendation.description ?? "Description not recorded"}
                  </p>
                  <span className="text-[9px] leading-[14px] text-muted-foreground">
                    {urgencyLabel(recommendation.urgency)}
                    {urgencyGermanTerm(recommendation.urgency) ? ` (${String(urgencyGermanTerm(recommendation.urgency))})` : ""}
                    {" · "}{recordStatusLabel(recommendation.status)} · {recommendation.plannedYear ?? recommendation.targetYear ?? "Year not recorded"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="finding-evidence-heading" className="grid gap-3 py-5">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="m-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Traceability
            </p>
            <h3 className="m-0 text-sm leading-5" id="finding-evidence-heading">
              Evidence
            </h3>
          </div>
          <span className="text-[10px] leading-[15px] text-muted-foreground">
            {String(new Set(finding.evidence.map((item) => item.evidenceId)).size)} sources
          </span>
        </div>
        <EvidenceSources bridgeId={bridgeId} citations={finding.evidence} />
      </section>
    </DetailPanel>
  );
}

function NormalizedField({
  citations,
  fieldNames,
  label,
  value,
  wide = false
}: {
  readonly citations: BridgeFinding["evidence"];
  readonly fieldNames: readonly string[];
  readonly label: string;
  readonly value: string | null;
  readonly wide?: boolean;
}): React.ReactElement {
  return (
    <div className={cn("min-w-0 bg-card p-2.5", wide ? "col-span-2" : undefined)}>
      <dt className="flex items-center justify-between gap-1.5 text-[10px] font-semibold leading-[15px] text-muted-foreground">
        {label}
        <FieldProvenanceBadge citations={citations} fieldNames={fieldNames} />
      </dt>
      <dd className="m-0 mt-1 overflow-hidden text-ellipsis text-xs leading-[18px]">
        {value ?? "Not recorded"}
      </dd>
    </div>
  );
}

function RatingDetail({
  citations,
  fieldName,
  label,
  shortLabel,
  value
}: {
  readonly citations: BridgeFinding["evidence"];
  readonly fieldName: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: number | null;
}): React.ReactElement {
  return (
    <div className="grid gap-0.5 border-l-[3px] border-l-border-strong px-2.5 py-1.5">
      <span className="text-sm font-bold leading-[18px]">
        {shortLabel} {rating(value)}
      </span>
      <span className="text-[10px] font-semibold leading-[14px]">{label}</span>
      <span className="text-[9px] leading-[14px] text-muted-foreground">{ratingLabel(value)}</span>
      <FieldProvenanceBadge citations={citations} fieldNames={[fieldName]} />
    </div>
  );
}

function LinkedRecommendationSummary({ finding }: { readonly finding: BridgeFinding }): React.ReactElement {
  const first = finding.linkedRecommendations[0];
  if (first === undefined) {
    return <span className="text-[10px] not-italic leading-[15px] text-muted-foreground">None linked</span>;
  }
  return (
    <div className="min-w-0">
      <span className="block text-xs font-semibold leading-[17px]">
        {first.workType ?? "Recommended work"}
      </span>
      <span className="block text-[10px] leading-[15px] text-muted-foreground">
        {urgencyLabel(first.urgency)}
        {urgencyGermanTerm(first.urgency) ? ` (${String(urgencyGermanTerm(first.urgency))})` : ""}
        {finding.linkedRecommendations.length > 1
          ? ` · +${String(finding.linkedRecommendations.length - 1)} more`
          : ""}
      </span>
    </div>
  );
}

function SvdValues({ ratings }: { readonly ratings: BridgeFinding["ratings"] }): React.ReactElement {
  return (
    <div
      aria-label={`S ${rating(ratings.stability)}, V ${rating(ratings.trafficSafety)}, D ${rating(ratings.durability)}`}
      className="flex gap-1"
    >
      <SvdChip label="S" value={rating(ratings.stability)} />
      <SvdChip label="V" value={rating(ratings.trafficSafety)} />
      <SvdChip label="D" value={rating(ratings.durability)} />
    </div>
  );
}

function componentLabel(finding: BridgeFinding): string | null {
  if (finding.component === null) {
    return null;
  }
  return [finding.component.name, finding.component.type].filter(Boolean).join(" · ");
}

function formatQuantity(quantity: BridgeFinding["quantity"]): string {
  return quantity === null
    ? "Not recorded"
    : formatMeasurement(quantity.value, quantity.unit);
}

function formatDimensions(finding: BridgeFinding): string {
  const dimensions = finding.dimensions;
  if (dimensions === null) {
    return "Not recorded";
  }
  const values = [dimensions.length, dimensions.width, dimensions.depth]
    .filter((value): value is string => value !== null)
    .map((value) => formatMeasurement(value, dimensions.unit));
  return values.length === 0 ? "Not recorded" : values.join(" × ");
}

function findingHref(bridgeId: string, findingId: string): string {
  return `/bridges/${bridgeId}?tab=findings&finding=${findingId}`;
}

function rating(value: number | null): string {
  return value === null ? "–" : String(value);
}
