import type { WorkPackageDetailResponse, WorkPackageSnapshot } from "@bridge-os/contracts";
import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StatusBadge, SvdChip } from "../../components/ui/data-display";
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
  formatConditionScore,
  formatCurrency,
  formatGermanDate,
  formatMeasurement,
  formatPercentage
} from "../../lib/formatters";
import { EvidenceSources } from "../bridges/evidence-sources";

type WorkPackage = WorkPackageDetailResponse["data"];
type Finding = WorkPackageSnapshot["scope"]["findings"][number];
type Component = WorkPackageSnapshot["scope"]["components"][number];

export function WorkPackageDetail({
  workPackage
}: {
  readonly workPackage: WorkPackage;
}): React.ReactElement {
  const snapshot = workPackage.snapshot;
  const bridge = snapshot.asset.bridge;
  const available = snapshot.readiness.filter((item) => item.state === "AVAILABLE").length;
  const gaps = snapshot.readiness.filter((item) => item.state !== "AVAILABLE").length;

  return (
    <div className="grid min-w-0 gap-4">
      <section aria-label="Work package headline facts" className="grid grid-cols-4 gap-3">
        <HudStat
          detail={presentText(bridge.name)}
          label="Year"
          value={presentText(snapshot.scope.plannedYear)}
        />
        <HudStat
          compact
          detail={estimateSourceLabel(snapshot.commercialPlanning.estimateSource)}
          label="Estimate"
          tone={snapshot.commercialPlanning.planningEstimate ? "ok" : "warning"}
          value={moneyLabel(snapshot.commercialPlanning.planningEstimate)}
        />
        <HudStat
          detail={`${String(snapshot.readiness.length)} checklist items`}
          label="Ready"
          value={`${String(available)}/${String(snapshot.readiness.length)}`}
        />
        <HudStat
          detail="Missing or required inputs"
          label="Gaps"
          tone={gaps > 0 ? "warning" : "ok"}
          value={gaps}
        />
      </section>

      <p
        className="m-0 border border-border border-l-[3px] border-l-info bg-card px-3 py-2 text-[12px] leading-4 text-muted-foreground"
        role="note"
      >
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-info">
          Planning draft
        </span>
        {" · "}
        {snapshot.disclaimer} Verify live asset and site conditions before use.
      </p>

      <section aria-labelledby="scope-heading" className="grid min-w-0 gap-3">
        <SectionHeader
          description="The managerial intervention and its linked source recommendation, findings, and affected components."
          id="scope-heading"
          title="Asset and scope"
        />
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          <SectionBlock title="Asset">
            <FactList>
              <FactRow label="Structure number" value={bridge.externalStructureNumber} />
              <FactRow label="Name" value={bridge.name} />
              <FactRow label="Partial structure" value={snapshot.asset.partialStructure.externalNumber} />
              <FactRow label="Road" value={bridge.road} />
              <FactRow label="Location" value={locationLabel(bridge.location)} />
              <FactRow label="Responsible authority" value={bridge.responsibleAuthority} />
              <FactRow label="Maintenance office" value={bridge.maintenanceOffice} />
            </FactList>
            <RecordLink href={`/bridges/${bridge.id}`}>Open live bridge record</RecordLink>
          </SectionBlock>
          <SectionBlock title="Draft scope">
            <FactList>
              <FactRow label="Intervention" value={snapshot.scope.workType} />
              <FactRow label="Description" value={snapshot.scope.description} />
              <FactRow label="Urgency" value={urgencyLabel(snapshot.scope.urgency)} />
              <FactRow label="Planned timing" value={snapshot.scope.plannedYear} />
              <FactRow label="Quantity" value={quantityLabel(snapshot.scope.quantity)} />
              <FactRow label="Quantity basis" value={quantitySourceLabel(snapshot.scope.quantitySource)} />
            </FactList>
          </SectionBlock>
        </div>

        <div className="grid gap-2">
          <h3 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
            Affected components
          </h3>
          {snapshot.scope.components.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {snapshot.scope.components.map((component) => (
                <ComponentContext component={component} key={component.id} />
              ))}
            </div>
          ) : (
            <p className="m-0 text-[12px] text-warning">Affected component not recorded.</p>
          )}
        </div>

        <div className="grid gap-2">
          <h3 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
            Linked findings
          </h3>
          <FindingsTable bridgeId={bridge.id} findings={snapshot.scope.findings} />
        </div>
      </section>

      <section aria-labelledby="context-heading" className="grid min-w-0 gap-3">
        <SectionHeader
          description="Recorded context for scope definition. Missing values remain explicit and are not treated as verified site conditions."
          id="context-heading"
          title="Technical and operational context"
        />
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          <TechnicalContext snapshot={snapshot} />
          <OperationalContext snapshot={snapshot} />
        </div>
      </section>

      <section aria-labelledby="commercial-heading" className="grid min-w-0 gap-3">
        <SectionHeader
          description="Planning estimates remain distinct from cost values in source recommendations."
          id="commercial-heading"
          title="Commercial and planning basis"
        />
        <dl className="m-0 grid grid-cols-4 border border-border-strong bg-card">
          <ContextFact
            detail={estimateSourceLabel(snapshot.commercialPlanning.estimateSource)}
            label="Planning estimate"
            value={moneyLabel(snapshot.commercialPlanning.planningEstimate)}
          />
          <ContextFact
            label="Estimate status"
            value={labelValue(snapshot.commercialPlanning.estimateStatus)}
          />
          <ContextFact
            detail="Source fact; not promoted to planning estimate"
            label="Source rec estimate"
            value={moneyLabel(snapshot.commercialPlanning.sourceRecommendationEstimate)}
          />
          <ContextFact
            label="Planned year"
            value={snapshot.commercialPlanning.plannedYear}
          />
        </dl>
      </section>

      <section aria-labelledby="evidence-heading" className="grid min-w-0 gap-3">
        <SectionHeader
          description="Field-level citations retain source versus derived status and link back to document records."
          id="evidence-heading"
          meta={`${String(snapshot.evidence.citations.length)} associations`}
          title="Evidence and related documents"
        />
        <InspectionContext snapshot={snapshot} />
        <EvidenceSources
          bridgeId={bridge.id}
          citations={snapshot.evidence.citations.map((item) => item.citation)}
        />
        <RelatedDocuments bridgeId={bridge.id} snapshot={snapshot} />
      </section>

      <section aria-labelledby="readiness-heading" className="grid min-w-0 gap-3">
        <SectionHeader
          description="Checklist states are computed conservatively from the information captured in this snapshot."
          id="readiness-heading"
          title="Readiness checklist"
        />
        <ul className="m-0 grid list-none border border-border-strong bg-card p-0">
          {snapshot.readiness.map((item) => (
            <li
              className="grid min-h-[52px] grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 [&+&]:border-t [&+&]:border-border"
              key={item.code}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5",
                  item.state === "AVAILABLE" ? "bg-success" : "bg-warning"
                )}
              />
              <div className="grid gap-px">
                <strong className="text-[13px] font-medium leading-5">{item.label}</strong>
                <span className="text-[12px] leading-4 text-muted-foreground">{item.detail}</span>
              </div>
              <StatusBadge tone={item.state === "AVAILABLE" ? "success" : "warning"}>
                {item.state === "AVAILABLE" ? "Available" : item.state === "MISSING" ? "Missing" : "Required"}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HudStat({
  compact = false,
  detail,
  label,
  tone = "ok",
  value
}: {
  readonly compact?: boolean;
  readonly detail: string;
  readonly label: string;
  readonly tone?: "ok" | "warning";
  readonly value: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5 border border-border-strong bg-card px-4 py-3",
        tone === "warning" && "border-l-[3px] border-l-warning"
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-chrome">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono font-medium leading-none tabular-nums tracking-tight",
          compact ? "text-[22px]" : "text-[34px]",
          tone === "warning" ? "text-warning" : "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="truncate text-[12px] leading-4 text-muted-foreground">{detail}</span>
    </div>
  );
}

function SectionBlock({
  title,
  children
}: {
  readonly title: ReactNode;
  readonly children: ReactNode;
}): React.ReactElement {
  return (
    <div className="min-w-0 border border-border-strong bg-card">
      <h3 className="m-0 flex h-9 items-center gap-1.5 bg-chrome px-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-chrome-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function RecordLink({ href, children }: { readonly href: string; readonly children: ReactNode }): React.ReactElement {
  return (
    <Link
      className="flex items-center gap-1.5 border-t border-border px-3 py-2.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground hover:text-foreground"
      href={href}
    >
      {children}
    </Link>
  );
}

function FactList({ children }: { readonly children: ReactNode }): React.ReactElement {
  return <dl className="m-0">{children}</dl>;
}

function FindingsTable({ bridgeId, findings }: { readonly bridgeId: string; readonly findings: readonly Finding[] }): React.ReactElement {
  if (findings.length === 0) {
    return (
      <div className="border border-border-strong bg-card">
        <EmptyState compact description="No finding association was captured for this intervention." title="No linked findings" />
      </div>
    );
  }
  return (
    <div className="overflow-auto border border-border-strong bg-card">
      <Table>
        <TableCaption>Findings linked to the work package scope</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[9rem]">Finding</TableHead>
            <TableHead className="min-w-[14rem]">Defect</TableHead>
            <TableHead className="min-w-[12rem]">Location</TableHead>
            <TableHead className="w-[8rem]">Qty</TableHead>
            <TableHead className="w-[8.5rem]">S / V / D</TableHead>
            <TableHead className="w-[7rem]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <TableRow key={finding.id}>
              <TableCell>
                <Link
                  className="font-mono text-[12px] text-foreground hover:underline hover:underline-offset-2"
                  href={`/bridges/${bridgeId}?tab=findings&finding=${finding.id}`}
                >
                  {finding.sourceIdentifier ?? "No identifier"}
                </Link>
              </TableCell>
              <TableCell>
                <strong className="block truncate text-[12px] font-medium">
                  {finding.defectType ?? "Defect type not recorded"}
                </strong>
                <span className="line-clamp-1 block text-[11px] text-muted-foreground">
                  {finding.description ?? "Description not recorded"}
                </span>
              </TableCell>
              <TableCell>
                <span className="block text-[12px]">{finding.location ?? "Not recorded"}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {finding.extent ?? "Extent not recorded"}
                </span>
              </TableCell>
              <TableCell className="text-[12px]">{quantityLabel(finding.quantity)}</TableCell>
              <TableCell>
                <div className="flex items-baseline gap-2">
                  <SvdChip label="S" tone={svdTone(finding.ratings.stability)} value={ratingLabel(finding.ratings.stability)} />
                  <SvdChip label="V" tone={svdTone(finding.ratings.trafficSafety)} value={ratingLabel(finding.ratings.trafficSafety)} />
                  <SvdChip label="D" tone={svdTone(finding.ratings.durability)} value={ratingLabel(finding.ratings.durability)} />
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge tone={finding.status === "OPEN" ? "warning" : "neutral"}>
                  {labelValue(finding.status)}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComponentContext({ component }: { readonly component: Component }): React.ReactElement {
  const properties = Object.entries(component.additionalProperties ?? {});
  return (
    <article className="min-w-0 border border-border-strong bg-card">
      <div className="flex h-9 items-center justify-between gap-2 bg-chrome px-3">
        <strong className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-chrome-foreground">
          {component.name ?? labelValue(component.type)}
        </strong>
        <StatusBadge>{labelValue(component.type)}</StatusBadge>
      </div>
      <dl className="m-0">
        <FactRow label="Location" value={component.location} />
        <FactRow label="Material" value={component.material} />
        <FactRow label="Construction / install year" value={[component.constructionYear, component.installYear].filter(Boolean).join(" / ") || null} />
        {properties.map(([key, value]) => <FactRow key={key} label={propertyLabel(key)} value={value === null ? null : String(value)} />)}
      </dl>
    </article>
  );
}

function TechnicalContext({ snapshot }: { readonly snapshot: WorkPackageSnapshot }): React.ReactElement {
  const context = snapshot.technicalContext;
  return (
    <SectionBlock title="Technical context">
      <FactList>
        <FactRow label="Construction year" value={context.constructionYear} />
        <FactRow label="Structure type" value={context.structureType} />
        <FactRow label="Structural system" value={context.structuralSystem} />
        <FactRow label="Length" value={measurementLabel(context.dimensions.lengthM, "m")} />
        <FactRow label="Width" value={measurementLabel(context.dimensions.widthM, "m")} />
        <FactRow label="Bridge area" value={measurementLabel(context.dimensions.areaSqM, "m²")} />
        <FactRow label="Clear height" value={measurementLabel(context.dimensions.clearHeightM, "m")} />
        <FactRow label="Spans" value={context.dimensions.spanCount} />
      </FactList>
    </SectionBlock>
  );
}

function OperationalContext({ snapshot }: { readonly snapshot: WorkPackageSnapshot }): React.ReactElement {
  const context = snapshot.operationalContext;
  return (
    <SectionBlock title="Operational context">
      <FactList>
        <FactRow label="Daily traffic" value={context.traffic?.dailyTraffic === null || context.traffic === null ? null : new Intl.NumberFormat("de-DE").format(context.traffic.dailyTraffic)} />
        <FactRow label="Truck share" value={context.traffic === null ? null : formatPercentage(context.traffic.truckSharePercent)} />
        <FactRow
          label="HGV / day"
          value={
            context.traffic?.heavyVehicleDaily == null
              ? null
              : new Intl.NumberFormat("de-DE").format(context.traffic.heavyVehicleDaily)
          }
        />
        <FactRow label="Traffic observation" value={context.traffic?.observedOn ? formatGermanDate(context.traffic.observedOn) : context.traffic?.observationYear ?? null} />
        <FactRow label="Inspection / access equipment" value={context.inspectionAccessEquipment} />
        <FactRow label="Traffic-management requirements" value={context.trafficManagementRequirements} />
        <FactRow label="Known constraints" value={context.knownConstraints.length > 0 ? context.knownConstraints.join("; ") : null} />
      </FactList>
      <p className="m-0 border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground">
        “Not recorded” means this draft cannot confirm the condition; it does not mean no constraint exists.
      </p>
    </SectionBlock>
  );
}

function InspectionContext({ snapshot }: { readonly snapshot: WorkPackageSnapshot }): React.ReactElement {
  const latest = snapshot.evidence.latestInspection;
  return (
    <dl className="m-0 grid grid-cols-4 border border-border-strong bg-card">
      <ContextFact
        detail="Linked through findings"
        label="Source inspections"
        value={snapshot.evidence.sourceInspections.length}
      />
      <ContextFact
        detail={latest ? labelValue(latest.type) : undefined}
        label="Latest inspection"
        value={latest ? formatGermanDate(latest.inspectedOn) : null}
      />
      <ContextFact
        detail="Lower is better"
        label="Condition"
        value={latest ? formatConditionScore(latest.conditionScore) : null}
      />
      <ContextFact
        label="Cycle status"
        value={latest ? labelValue(latest.dueStatus) : null}
      />
    </dl>
  );
}

function RelatedDocuments({ bridgeId, snapshot }: { readonly bridgeId: string; readonly snapshot: WorkPackageSnapshot }): React.ReactElement {
  return (
    <div className="grid gap-2">
      <h3 className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.14em]">
        Related documents and media
      </h3>
      {snapshot.evidence.documents.length > 0 ? (
        <ul className="m-0 list-none border border-border-strong bg-card p-0">
          {snapshot.evidence.documents.map((document) => {
            const pages = relatedPages(snapshot, document.id);
            return (
              <li
                className="grid min-h-[52px] grid-cols-[18px_minmax(220px,1fr)_auto_auto] items-center gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-border"
                key={document.id}
              >
                <FileText aria-hidden="true" className="text-muted-foreground" size={15} />
                <div className="grid min-w-0 gap-px">
                  <strong className="truncate text-[13px] font-medium leading-5">{document.originalFilename}</strong>
                  <span className="truncate text-[12px] leading-4 text-muted-foreground">
                    {document.type} · {pages.length > 0 ? `Evidence pages ${pages.join(", ")}` : "No evidence page association"}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {document.isDrawing ? <StatusBadge tone="info">Drawing</StatusBadge> : null}
                  {document.isPhoto ? <StatusBadge tone="info">Photo</StatusBadge> : null}
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/bridges/${bridgeId}?tab=documents#document-${document.id}`}>Document</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-[12px] text-warning">No related document records were captured.</p>
      )}
    </div>
  );
}

function FactRow({ label, value }: { readonly label: string; readonly value: ReactNode | null | undefined }): React.ReactElement {
  return (
    <div className="grid min-h-[38px] grid-cols-[150px_minmax(0,1fr)] items-baseline gap-3 border-b border-border px-3 py-2 last:border-b-0">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="m-0 overflow-hidden text-ellipsis text-[13px] leading-5">{present(value)}</dd>
    </div>
  );
}

function ContextFact({
  detail,
  label,
  value
}: {
  readonly detail?: string | undefined;
  readonly label: string;
  readonly value: number | string | null | undefined;
}): React.ReactElement {
  return (
    <div className="min-h-[68px] border-l border-border p-3 first:border-l-0">
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-1 text-[13px] leading-5">{present(value)}</dd>
      {detail ? (
        <dd className="m-0 mt-0.5 text-[11px] leading-4 text-muted-foreground">{detail}</dd>
      ) : null}
    </div>
  );
}

function present(value: ReactNode | null | undefined): ReactNode {
  return value === null || value === undefined || value === "" ? (
    <span className="text-[12px] text-warning">Not recorded</span>
  ) : (
    value
  );
}

function presentText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function quantityLabel(quantity: WorkPackageSnapshot["scope"]["quantity"]): string {
  return quantity ? formatMeasurement(quantity.value, quantity.unit) : "Not recorded";
}

function measurementLabel(value: string | null, unit: string): string | null {
  return value === null ? null : formatMeasurement(value, unit);
}

function moneyLabel(value: WorkPackageSnapshot["commercialPlanning"]["planningEstimate"]): string {
  return value ? formatCurrency(value.amount, value.currency) : "Required";
}

function ratingLabel(value: number | null): string {
  return value === null ? "–" : String(value);
}

function svdTone(value: number | null): "critical" | "neutral" | "warning" {
  if (value === null) return "neutral";
  if (value >= 3) return "critical";
  if (value === 2) return "warning";
  return "neutral";
}

function labelValue(value: string | null): string {
  if (value === null) return "Not recorded";
  return value.replaceAll("_", " ").toLocaleLowerCase("de-DE").replace(/^./u, (character) => character.toLocaleUpperCase("de-DE"));
}

function urgencyLabel(value: string | null): string {
  if (value === null) return "Not recorded";
  const labels: Record<string, string> = {
    SOFORT: "Immediate",
    KURZFRISTIG: "Short term",
    MITTELFRISTIG: "Medium term",
    LANGFRISTIG: "Long term"
  };
  return labels[value.toUpperCase()] ?? value;
}

function quantitySourceLabel(value: WorkPackageSnapshot["scope"]["quantitySource"]): string {
  if (value === "PLANNED_INTERVENTION") return "Managerial intervention";
  if (value === "SOURCE_RECOMMENDATION") return "Source recommendation";
  return "Not recorded";
}

function estimateSourceLabel(value: WorkPackageSnapshot["commercialPlanning"]["estimateSource"]): string {
  if (value === "USER_PLANNING") return "User planning estimate";
  if (value === "EXTERNAL_ENRICHED") return "Externally enriched estimate";
  return "Estimate source not recorded";
}

function locationLabel(location: WorkPackageSnapshot["asset"]["bridge"]["location"]): string | null {
  const parts = [location.locality, location.municipality, location.district, location.federalState].filter((value): value is string => value !== null);
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

function relatedPages(snapshot: WorkPackageSnapshot, documentId: string): number[] {
  const document = snapshot.evidence.documents.find((item) => item.id === documentId);
  const citationPages = snapshot.evidence.citations
    .filter((item) => item.citation.documentId === documentId)
    .map((item) => item.citation.pageNumber)
    .filter((page): page is number => page !== null);
  return [...new Set([...(document?.evidencePages ?? []), ...citationPages])]
    .sort((left, right) => left - right);
}

function propertyLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/gu, "$1 $2").replace(/^./u, (character) => character.toLocaleUpperCase("en-US"));
}
