import type {
  BridgeDetailResponse,
  BridgeDocumentsResponse,
  BridgeInspectionsResponse,
  BridgeRecommendationsResponse,
  EvidenceCitation
} from "@bridge-os/contracts";
import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ConditionBadge,
  InflationAdjustedEstimate,
  StatusBadge
} from "../../components/ui/data-display";
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
import {
  formatCurrency,
  formatGermanDate,
  formatMeasurement,
  formatPercentage
} from "../../lib/formatters";
import {
  inspectionTypeGermanTerm,
  inspectionTypeLabel,
  recordStatusLabel,
  recordStatusTone,
  trafficSourceLabel,
  trafficSourceTitle,
  urgencyGermanTerm,
  urgencyLabel
} from "./detail-labels";
import { EvidenceList } from "./evidence-list";

interface TabProps<Data> {
  readonly bridgeId: string;
  readonly data: Data;
}

function TableFrame({ children }: { readonly children: ReactNode }): React.ReactElement {
  return (
    <div className="overflow-hidden border border-border-strong bg-card">
      {children}
    </div>
  );
}

function Primary({ children }: { readonly children: ReactNode }): React.ReactElement {
  return <strong className="block text-xs font-semibold leading-[17px]">{children}</strong>;
}

function Secondary({
  children,
  title
}: {
  readonly children: ReactNode;
  readonly title?: string | undefined;
}): React.ReactElement {
  return (
    <span className="block text-[11px] leading-4 text-muted-foreground" title={title}>
      {children}
    </span>
  );
}

export function InspectionsTab({
  bridgeId,
  data
}: TabProps<BridgeInspectionsResponse["data"]>): React.ReactElement {
  return (
    <section aria-labelledby="inspections-heading" className="grid min-h-[300px] min-w-0 content-start gap-3">
      <SectionHeader
        description="Recorded inspections across all partial structures, newest first."
        id="inspections-heading"
        meta={`${String(data.length)} records`}
        title="Inspections"
      />
      {data.length === 0 ? (
        <EmptyState compact title="No inspections recorded" />
      ) : (
        <TableFrame>
          <Table className="min-w-[1050px] table-fixed">
            <TableCaption>Bridge inspections</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px]">Date / type</TableHead>
                <TableHead className="w-[90px]">Condition</TableHead>
                <TableHead className="w-[140px]">Inspector</TableHead>
                <TableHead className="w-[180px]">Partial structure</TableHead>
                <TableHead className="w-[150px]">Cycle / next due</TableHead>
                <TableHead className="w-[300px]">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((inspection) => (
                <TableRow className="hover:bg-row-hover" key={inspection.id}>
                  <TableCell className="align-top">
                    <Primary>{formatGermanDate(inspection.inspectedOn)}</Primary>
                    <Secondary title={inspectionTypeGermanTerm(inspection.type)}>
                      {inspectionTypeLabel(inspection.type)}
                    </Secondary>
                  </TableCell>
                  <TableCell className="align-top"><ConditionBadge score={inspection.conditionScore} /></TableCell>
                  <TableCell className="align-top">{inspection.inspector ?? <Missing />}</TableCell>
                  <TableCell className="align-top">
                    {inspection.partialStructure.name ?? inspection.partialStructure.externalNumber ?? <Missing />}
                  </TableCell>
                  <TableCell className="align-top">
                    <Primary>
                      {inspection.cycleMonths === null ? "Cycle not recorded" : `${String(inspection.cycleMonths)} months`}
                    </Primary>
                    <Secondary>Due {formatGermanDate(inspection.nextDueOn)}</Secondary>
                  </TableCell>
                  <TableCell className="align-top">
                    <EvidenceList bridgeId={bridgeId} citations={inspection.evidence} limit={1} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </section>
  );
}

export function RecommendationsTab({
  bridgeId,
  data
}: TabProps<BridgeRecommendationsResponse["data"]>): React.ReactElement {
  return (
    <section aria-labelledby="recommendations-heading" className="grid min-h-[300px] min-w-0 content-start gap-3">
      <SectionHeader
        description="Recommended interventions, planning context, quantities, costs, and source evidence."
        id="recommendations-heading"
        meta={`${String(data.length)} records`}
        title="Recommendations"
      />
      {data.length === 0 ? (
        <EmptyState compact title="No recommendations recorded" />
      ) : (
        <TableFrame>
          <Table>
            <TableCaption>Bridge recommendations</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[14rem]">Recommended work</TableHead>
                <TableHead className="w-[8.5rem]">Urgency</TableHead>
                <TableHead className="w-[8.5rem]">Status</TableHead>
                <TableHead className="w-[8rem]">Quantity</TableHead>
                <TableHead className="w-[8.5rem]">Estimated cost</TableHead>
                <TableHead className="w-[8.5rem]">Planned / target</TableHead>
                <TableHead className="min-w-[12rem]">Linked findings</TableHead>
                <TableHead className="min-w-[14rem]">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((recommendation) => (
                <TableRow
                  className="scroll-mt-24 hover:bg-row-hover target:bg-accent"
                  id={`recommendation-${recommendation.id}`}
                  key={recommendation.id}
                >
                  <TableCell className="align-top">
                    <Primary>{recommendation.workType ?? "Work type not recorded"}</Primary>
                    <Secondary>
                      <span className="line-clamp-2">{recommendation.description ?? "Description not recorded"}</span>
                    </Secondary>
                  </TableCell>
                  <TableCell className="align-top">
                    {recommendation.urgency ? (
                      <StatusBadge
                        srLabel={
                          urgencyGermanTerm(recommendation.urgency)
                            ? `${urgencyLabel(recommendation.urgency)} (${String(urgencyGermanTerm(recommendation.urgency))})`
                            : undefined
                        }
                        title={urgencyGermanTerm(recommendation.urgency)}
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
                  <TableCell className="align-top">
                    <StatusBadge tone={recordStatusTone(recommendation.status)}>
                      {recordStatusLabel(recommendation.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="align-top">{formatQuantity(recommendation.quantity)}</TableCell>
                  <TableCell className="align-top">
                    {recommendation.sourceEstimatedCost
                      ? formatCurrency(
                          recommendation.sourceEstimatedCost.amount,
                          recommendation.sourceEstimatedCost.currency
                        )
                      : <Missing />}
                    <InflationAdjustedEstimate adjustment={recommendation.inflationAdjustedEstimate} />
                  </TableCell>
                  <TableCell className="align-top">
                    <Primary>{recommendation.plannedYear ?? "Not planned"}</Primary>
                    <Secondary>Target {recommendation.targetYear ?? "not recorded"}</Secondary>
                  </TableCell>
                  <TableCell className="align-top">
                    <LinkedFindingsCell
                      bridgeId={bridgeId}
                      findings={recommendation.linkedFindings}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <EvidenceList bridgeId={bridgeId} citations={recommendation.evidence} limit={1} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </section>
  );
}

function LinkedFindingsCell({
  bridgeId,
  findings
}: {
  readonly bridgeId: string;
  readonly findings: BridgeRecommendationsResponse["data"][number]["linkedFindings"];
}): React.ReactElement {
  if (findings.length === 0) {
    return <span className="text-[11px] leading-4 text-muted-foreground">No linked finding</span>;
  }
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {findings.map((finding) => (
        <li className="grid gap-px" key={finding.id}>
          <Link
            className="block w-fit rounded-xs bg-muted px-1 py-0.5 text-[10px] font-semibold text-primary hover:underline hover:underline-offset-2"
            href={findingHref(bridgeId, finding.id)}
            title={finding.description ?? undefined}
          >
            {finding.sourceIdentifier ?? finding.defectType ?? "Finding"}
          </Link>
          {finding.defectType && finding.sourceIdentifier ? (
            <Secondary>{finding.defectType}</Secondary>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function findingHref(bridgeId: string, findingId: string): string {
  return `/bridges/${bridgeId}?tab=findings&finding=${findingId}`;
}

export function TechnicalDataTab({
  bridge
}: {
  readonly bridge: BridgeDetailResponse["data"];
}): React.ReactElement {
  return (
    <div className="grid min-w-0 gap-6">
      <section aria-labelledby="responsibility-heading" className="grid min-h-[300px] min-w-0 content-start gap-3">
        <SectionHeader id="responsibility-heading" title="Network and responsibility" />
        <dl className="m-0 grid grid-cols-5 border border-border-strong bg-card">
          <ContextFact label="Road" value={bridge.road} />
          <ContextFact label="Crossed feature" value={bridge.location.crossedFeature} />
          <ContextFact label="Owner" value={bridge.responsibility.owner} />
          <ContextFact label="Baulast" value={bridge.responsibility.loadBearingResponsibility} />
          <ContextFact label="Responsible authority" value={bridge.responsibility.responsibleAuthority} />
          <ContextFact label="Maintenance office" value={bridge.responsibility.maintenanceOffice} />
          <ContextFact label="Federal state" value={bridge.location.federalState} />
          <ContextFact label="District" value={bridge.location.district} />
          <ContextFact label="Municipality" value={bridge.location.municipality} />
          <ContextFact label="Coordinates" value={formatCoordinates(bridge.location)} />
          <ContextFact
            label="Traffic"
            value={
              bridge.latestTraffic?.dailyTraffic === null || bridge.latestTraffic?.dailyTraffic === undefined
                ? null
                : formatMeasurement(bridge.latestTraffic.dailyTraffic, "vehicles/day", 0)
            }
            {...(bridge.latestTraffic
              ? {
                  detail: trafficSourceLabel(bridge.latestTraffic.source),
                  detailTitle: trafficSourceTitle(bridge.latestTraffic.source)
                }
              : {})}
          />
          <ContextFact label="Truck share" value={formatPercentage(bridge.latestTraffic?.truckSharePercent)} />
          <ContextFact
            label="HGV / day"
            value={
              bridge.latestTraffic?.heavyVehicleDaily === null ||
              bridge.latestTraffic?.heavyVehicleDaily === undefined
                ? null
                : formatMeasurement(bridge.latestTraffic.heavyVehicleDaily, "", 0).trim()
            }
          />
        </dl>
      </section>

      <section aria-labelledby="partial-structures-heading" className="grid min-w-0 content-start gap-3">
        <SectionHeader
          id="partial-structures-heading"
          meta={`${String(bridge.partialStructures.length)} records`}
          title="Partial structures"
        />
        {bridge.partialStructures.length === 0 ? (
          <EmptyState compact title="No partial structures recorded" />
        ) : (
          <TableFrame>
            <Table className="min-w-[1200px] table-fixed">
              <TableCaption>Partial structures</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Teilbauwerk</TableHead>
                  <TableHead>Type / system</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Spans / clear height</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridge.partialStructures.map((structure) => (
                  <TableRow className="hover:bg-row-hover" key={structure.id}>
                    <TableCell className="align-top">
                      <Primary>{structure.name ?? structure.externalNumber ?? "Unnamed"}</Primary>
                    </TableCell>
                    <TableCell className="align-top">
                      <Primary>{structure.structureType ?? "Type not recorded"}</Primary>
                      <Secondary>{structure.structuralSystem ?? "System not recorded"}</Secondary>
                    </TableCell>
                    <TableCell className="align-top">{structure.constructionYear ?? <Missing />}</TableCell>
                    <TableCell className="align-top">
                      <Primary>
                        {formatMeasurement(structure.geometry.lengthM, "m")} × {formatMeasurement(structure.geometry.widthM, "m")}
                      </Primary>
                      <Secondary>{formatMeasurement(structure.geometry.areaSqM, "m²")}</Secondary>
                    </TableCell>
                    <TableCell className="align-top">
                      <Primary>{structure.geometry.spanCount ?? "Spans not recorded"}</Primary>
                      <Secondary>Clear height {formatMeasurement(structure.geometry.clearHeightM, "m")}</Secondary>
                    </TableCell>
                    <TableCell className="align-top">
                      <EvidenceList bridgeId={bridge.id} citations={structure.evidence} limit={1} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </section>

      <section aria-labelledby="components-heading" className="grid min-w-0 content-start gap-3">
        <SectionHeader
          id="components-heading"
          meta={`${String(bridge.technicalData.components.length)} records`}
          title="Component register"
        />
        {bridge.technicalData.components.length === 0 ? (
          <EmptyState compact title="No components recorded" />
        ) : (
          <TableFrame>
            <Table className="min-w-[1100px] table-fixed">
              <TableCaption>Bridge components</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Component</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Construction / install</TableHead>
                  <TableHead>Teilbauwerk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridge.technicalData.components.map((component) => (
                  <TableRow className="hover:bg-row-hover" key={component.id}>
                    <TableCell className="align-top">
                      <Primary>{component.name ?? "Unnamed component"}</Primary>
                    </TableCell>
                    <TableCell className="align-top">{component.type ?? <Missing />}</TableCell>
                    <TableCell className="align-top">{component.location ?? <Missing />}</TableCell>
                    <TableCell className="align-top">{component.material ?? <Missing />}</TableCell>
                    <TableCell className="align-top">
                      <Primary>Built {component.constructionYear ?? "not recorded"}</Primary>
                      <Secondary>Installed {component.installYear ?? "not recorded"}</Secondary>
                    </TableCell>
                    <TableCell className="align-top">
                      {component.partialStructure.externalNumber ?? component.partialStructure.name ?? <Missing />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </section>
    </div>
  );
}

export function DocumentsTab({
  bridge,
  data
}: {
  readonly bridge: BridgeDetailResponse["data"];
  readonly data: BridgeDocumentsResponse["data"];
}): React.ReactElement {
  const citations = collectOverviewEvidence(bridge);
  return (
    <div className="grid min-w-0 gap-6">
      <section aria-labelledby="documents-heading" className="grid min-h-[300px] min-w-0 content-start gap-3">
        <SectionHeader
          description="Source documents linked to this asset. Demo fixtures are explicitly identified."
          id="documents-heading"
          meta={`${String(data.length)} documents`}
          title="Documents"
        />
        {data.length === 0 ? (
          <EmptyState compact title="No documents linked" />
        ) : (
          <TableFrame>
            <Table className="min-w-[900px] table-fixed">
              <TableCaption>Bridge documents</TableCaption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evidence coverage</TableHead>
                  <TableHead>Partial structure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((document) => (
                  <TableRow
                    className="scroll-mt-24 hover:bg-row-hover target:bg-accent"
                    id={`document-${document.id}`}
                    key={document.id}
                  >
                    <TableCell className="align-top">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <FileText className="shrink-0 text-muted-foreground" size={15} />
                        <strong className="truncate text-xs font-semibold">{document.originalFilename}</strong>
                      </span>
                      {document.isDemoFixture ? (
                        <Secondary>Demo fixture, extraction not performed</Secondary>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top">{document.type}</TableCell>
                    <TableCell className="align-top">
                      <StatusBadge tone={recordStatusTone(document.status)}>
                        {recordStatusLabel(document.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Primary>{String(document.evidenceCount)} citations</Primary>
                      <Secondary>
                        Pages {document.evidencePages.length > 0 ? document.evidencePages.join(", ") : "not recorded"}
                      </Secondary>
                    </TableCell>
                    <TableCell className="align-top">
                      {document.partialStructure?.externalNumber ?? document.partialStructure?.name ?? "Bridge level"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </section>

      <section aria-labelledby="evidence-heading" className="grid min-w-0 content-start gap-3">
        <SectionHeader
          description="Field-level citations available on the overview, partial structure, and traffic context."
          id="evidence-heading"
          meta={`${String(citations.length)} citations`}
          title="Evidence register"
        />
        <div className="max-h-[520px] overflow-y-auto border border-border-strong bg-card p-3.5">
          <EvidenceList bridgeId={bridge.id} citations={citations} />
        </div>
      </section>
    </div>
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
    <div className="min-h-[70px] border-l border-border p-3.5 [&:nth-child(5n+1)]:border-l-0 [&:nth-child(n+6)]:border-t">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="m-0 mt-1 overflow-hidden text-ellipsis text-[13px] leading-5">{value ?? "Not recorded"}</dd>
      {detail ? (
        <dd className="m-0 mt-0.5 text-[11px] leading-4 text-muted-foreground" title={detailTitle}>
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

function Missing(): React.ReactElement {
  return <span className="text-[11px] leading-4 text-muted-foreground">Not recorded</span>;
}

function formatQuantity(
  quantity: { readonly unit: string; readonly value: string } | null
): string {
  return quantity ? formatMeasurement(quantity.value, quantity.unit) : "Not recorded";
}

function formatCoordinates(
  location: BridgeDetailResponse["data"]["location"]
): string | null {
  if (location.latitude === null || location.longitude === null) {
    return null;
  }
  return `${location.latitude}, ${location.longitude}`;
}

function collectOverviewEvidence(
  bridge: BridgeDetailResponse["data"]
): EvidenceCitation[] {
  const citations = [
    ...bridge.evidence,
    ...bridge.partialStructures.flatMap((structure) => structure.evidence),
    ...(bridge.latestTraffic?.evidence ?? [])
  ];
  const unique = new Map(
    citations.map((citation) => [
      `${citation.evidenceId}-${citation.fieldName}`,
      citation
    ])
  );
  return [...unique.values()];
}
