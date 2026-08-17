import type { EvidenceCitation } from "@bridge-os/contracts";
import { ExternalLink, FileText, FunctionSquare, Link2Off } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  getFieldProvenance,
  groupEvidenceSources,
  type FieldProvenance,
  type FieldProvenanceKind
} from "./evidence-model";

interface EvidenceSourcesProps {
  readonly bridgeId: string;
  readonly citations: readonly EvidenceCitation[];
}

export function EvidenceSources({
  bridgeId,
  citations
}: EvidenceSourcesProps): React.ReactElement {
  const sources = groupEvidenceSources(citations);
  if (sources.length === 0) {
    return (
      <div className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-2 border border-border bg-surface-subtle p-3 text-muted-foreground">
        <Link2Off aria-hidden="true" size={17} />
        <div>
          <strong className="text-[11px]">No evidence associated</strong>
          <p className="m-0 mt-0.5 text-[10px] leading-[15px] text-muted-foreground">
            This finding has no field-level source record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      {sources.map((source) => {
        const sourceKind = summarizeKinds(
          source.associations.map((association) => association.kind)
        );
        return (
          <article
            className="grid gap-2.5 border border-border-strong bg-card p-3.5"
            key={source.evidenceId}
          >
            <header className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2">
              <FileText aria-hidden="true" className="mt-px text-info" size={16} />
              <div className="grid min-w-0 gap-px">
                <strong className="truncate text-[11px] leading-4">{source.originalFilename}</strong>
                <span className="text-[9px] leading-[14px] text-muted-foreground">
                  {source.documentType} · {pageLabel(source.pageNumber)}
                </span>
              </div>
              <EvidenceKindBadge kind={sourceKind} />
            </header>

            <dl className="m-0 grid grid-cols-3 bg-surface-subtle">
              {[
                ["Extraction method", extractionMethodLabel(source.extractionMethod)],
                ["Confidence", formatConfidence(source.extractionConfidence)],
                ["Review state", reviewStateLabel(source.reviewState)],
                ["Page region", source.boundingBox === null ? "Not recorded" : "Recorded"]
              ].map(([label, value], index) => (
                <div className={cn("px-2 py-1.5", index < 3 ? "border-r border-border" : undefined)} key={label}>
                  <dt className="text-[8px] font-semibold uppercase leading-3 text-muted-foreground">{label}</dt>
                  <dd className="m-0 mt-0.5 text-[10px] leading-[15px]">{value}</dd>
                </div>
              ))}
            </dl>

            {source.excerpt === null ? (
              <p className="text-[10px] not-italic leading-[15px] text-muted-foreground">
                Source excerpt not recorded.
              </p>
            ) : (
              <div className="grid gap-1 border-l-[3px] border-l-ring py-0.5 pl-2.5">
                <span className="text-[8px] font-semibold uppercase leading-3 text-muted-foreground">
                  Exact or near-exact source excerpt
                </span>
                <blockquote className="m-0 text-[11px] leading-[17px]" lang="de">
                  {source.excerpt}
                </blockquote>
              </div>
            )}

            <div className="grid gap-1.5">
              <span className="text-[8px] font-semibold uppercase leading-3 text-muted-foreground">
                Structured fields supported
              </span>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {source.associations.map((association) => (
                  <li
                    className="flex flex-wrap items-center gap-1.5 rounded-xs border border-border bg-surface-subtle py-0.5 pl-1.5 pr-1 text-[9px] leading-[15px]"
                    key={`${association.fieldName}-${association.kind}`}
                  >
                    <span>{fieldLabel(association.fieldName)}</span>
                    <EvidenceKindBadge kind={association.kind} />
                    {association.derivationMethod === null ? null : (
                      <small className="basis-full text-muted-foreground">{association.derivationMethod}</small>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <footer className="flex items-center gap-2 border-t border-border pt-2.5">
              {source.viewSourceUrl === null ? (
                <span className="mr-auto text-[10px] text-muted-foreground">Source file unavailable</span>
              ) : (
                <Button asChild size="sm">
                  <a href={source.viewSourceUrl} rel="noreferrer" target="_blank">
                    View source
                    <ExternalLink aria-hidden="true" size={14} />
                  </a>
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link href={`/bridges/${bridgeId}?tab=documents#document-${source.documentId}`}>
                  Document record
                </Link>
              </Button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export function FieldProvenanceBadge({
  citations,
  fieldNames
}: {
  readonly citations: readonly EvidenceCitation[];
  readonly fieldNames: readonly string[];
}): React.ReactElement {
  const provenance = getFieldProvenance(citations, fieldNames);
  return (
    <span className="shrink-0" title={derivationTitle(provenance)}>
      <EvidenceKindBadge kind={provenance.kind} />
    </span>
  );
}

const evidenceKindClasses: Record<FieldProvenanceKind | EvidenceCitation["kind"], string> = {
  SOURCE_FACT: "border-success-border bg-success-bg text-success",
  DERIVED: "border-info-border bg-info-bg text-info",
  MIXED: "border-info-border bg-info-bg text-info",
  UNLINKED: "border-border bg-surface-subtle text-muted-foreground"
};

function EvidenceKindBadge({
  kind
}: {
  readonly kind: FieldProvenanceKind | EvidenceCitation["kind"];
}): React.ReactElement {
  const derived = kind === "DERIVED" || kind === "MIXED";
  const Icon = derived ? FunctionSquare : kind === "UNLINKED" ? Link2Off : FileText;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xs border px-1 text-[9px] font-semibold leading-[15px]",
        evidenceKindClasses[kind]
      )}
    >
      <Icon aria-hidden="true" size={11} />
      {kindLabel(kind)}
    </span>
  );
}

function summarizeKinds(
  kinds: readonly EvidenceCitation["kind"][]
): EvidenceCitation["kind"] | "MIXED" {
  return new Set(kinds).size > 1 ? "MIXED" : (kinds[0] ?? "SOURCE_FACT");
}

function derivationTitle(provenance: FieldProvenance): string {
  if (provenance.derivationMethods.length > 0) {
    return provenance.derivationMethods.join("; ");
  }
  return kindLabel(provenance.kind);
}

function kindLabel(kind: FieldProvenanceKind | EvidenceCitation["kind"]): string {
  const labels = {
    DERIVED: "Derived",
    MIXED: "Mixed",
    SOURCE_FACT: "Source fact",
    UNLINKED: "No evidence"
  } as const;
  return labels[kind];
}

function extractionMethodLabel(method: EvidenceCitation["extractionMethod"]): string {
  const labels = {
    IMPORT: "Structured import",
    MANUAL: "Manual entry",
    MODEL_EXTRACTION: "Model extraction",
    OCR: "OCR",
    OTHER: "Other",
    TEXT_EXTRACTION: "Text extraction"
  } as const;
  return labels[method];
}

function formatConfidence(confidence: string | null): string {
  return confidence === null
    ? "Not available"
    : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(Number(confidence) * 100)} %`;
}

function reviewStateLabel(state: EvidenceCitation["reviewState"]): string {
  if (state === null) {
    return "Not applicable";
  }
  const labels = {
    AUTOMATICALLY_EXTRACTED: "Automatically extracted",
    HUMAN_CONFIRMED: "Human confirmed",
    HUMAN_REJECTED: "Human rejected"
  } as const;
  return labels[state];
}

function pageLabel(pageNumber: number | null): string {
  return pageNumber === null ? "Page not recorded" : `Page ${String(pageNumber)}`;
}

function fieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    componentId: "Component",
    defectType: "Defect type",
    description: "Description",
    dimensionDepth: "Depth",
    dimensionLength: "Length",
    dimensionUnit: "Dimension unit",
    dimensionWidth: "Width",
    durabilityRating: "Durability rating",
    extent: "Extent",
    location: "Location",
    quantity: "Quantity",
    quantityUnit: "Quantity unit",
    sourceIdentifier: "Finding identifier",
    stabilityRating: "Stability rating",
    status: "Status",
    trafficSafetyRating: "Traffic-safety rating"
  };
  return labels[fieldName] ?? fieldName;
}
