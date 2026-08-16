import { FileText, FunctionSquare, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatConditionScore } from "../../lib/formatters";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type StatusTone = "critical" | "info" | "neutral" | "success" | "warning";

interface MetricProps {
  readonly accent?: boolean;
  readonly detail?: ReactNode;
  readonly label: string;
  readonly size?: "default" | "sm";
  readonly tone?: StatusTone;
  readonly value: ReactNode;
  readonly variant?: "cell" | "tile";
}

const valueTone: Record<StatusTone, string> = {
  critical: "text-critical",
  info: "text-info",
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning"
};

export function Metric({
  accent = false,
  detail,
  label,
  size = "default",
  tone = "neutral",
  value,
  variant = "cell"
}: MetricProps): React.ReactElement {
  const resolvedTone = accent && tone === "neutral" ? "info" : tone;

  return (
    <dl
      className={cn(
        "m-0 grid min-w-0 gap-1",
        variant === "tile" ? "px-4 py-2.5" : "px-4 py-1"
      )}
    >
      <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "m-0 overflow-hidden text-ellipsis font-mono font-medium tabular-nums tracking-tight",
          valueTone[resolvedTone],
          size === "sm" ? "text-sm leading-5" : "text-[22px] leading-none"
        )}
      >
        {value}
      </dd>
      {detail ? (
        <dd className="m-0 text-[11px] font-normal leading-4 text-muted-foreground">
          {detail}
        </dd>
      ) : null}
    </dl>
  );
}

interface StatusBadgeProps {
  readonly children: ReactNode;
  /** Overrides the accessible name, e.g. to include the German source term. */
  readonly srLabel?: string | undefined;
  readonly title?: string | undefined;
  readonly tone?: StatusTone;
}

const statusBadgeVariant: Record<
  StatusTone,
  "critical" | "info" | "neutral" | "success" | "warning"
> = {
  critical: "critical",
  info: "info",
  neutral: "neutral",
  success: "success",
  warning: "warning"
};

const markTone: Record<StatusTone, string> = {
  critical: "bg-critical",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning"
};

export function StatusBadge({
  children,
  srLabel,
  title,
  tone = "neutral"
}: StatusBadgeProps): React.ReactElement {
  return (
    <Badge aria-label={srLabel} title={title} variant={statusBadgeVariant[tone]}>
      <span aria-hidden="true" className={cn("size-1.5 shrink-0", markTone[tone])} />
      {children}
    </Badge>
  );
}

interface ConditionBadgeProps {
  readonly score: number | string | null | undefined;
}

export function ConditionBadge({
  score
}: ConditionBadgeProps): React.ReactElement {
  if (score === null || score === undefined) {
    return <StatusBadge>Not recorded</StatusBadge>;
  }

  const numericScore = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(numericScore)) {
    throw new RangeError(`Invalid condition score: ${String(score)}`);
  }

  const tone = conditionScoreTone(numericScore);

  return (
    <span
      aria-label={`Condition score ${formatConditionScore(numericScore)}`}
      className={cn(
        "font-mono text-[13px] font-medium tabular-nums",
        valueTone[tone]
      )}
    >
      {formatConditionScore(numericScore)}
    </span>
  );
}

interface SvdChipProps {
  readonly label: string;
  readonly tone?: StatusTone;
  readonly value: string;
}

export function SvdChip({
  label,
  tone = "neutral",
  value
}: SvdChipProps): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
      <span>{label}</span>
      <strong className={cn("font-medium", valueTone[tone])}>{value}</strong>
    </span>
  );
}

interface ProvenanceLinkProps {
  readonly documentName: string;
  readonly fieldLabel?: string;
  readonly href: string;
  readonly kind?: "DERIVED" | "SOURCE_FACT";
  readonly pageNumber?: number | null;
}

export function ProvenanceLink({
  documentName,
  fieldLabel,
  href,
  kind = "SOURCE_FACT",
  pageNumber
}: ProvenanceLinkProps): React.ReactElement {
  const Icon: LucideIcon = kind === "DERIVED" ? FunctionSquare : FileText;
  const pageLabel = pageNumber ? `Page ${String(pageNumber)}` : null;

  return (
    <Link
      aria-label={`${fieldLabel ? `${fieldLabel}: ` : ""}${documentName}${pageLabel ? `, ${pageLabel}` : ""}${kind === "DERIVED" ? ", derived value" : ", source fact"}`}
      className="inline-flex max-w-full items-center gap-1.5 text-[12px] leading-4 text-info hover:[&>span:first-of-type]:underline hover:[&>span:first-of-type]:underline-offset-2"
      href={href}
    >
      <Icon aria-hidden="true" size={14} strokeWidth={1.6} />
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{documentName}</span>
      {pageLabel ? <span className="shrink-0 text-text-subtle">{pageLabel}</span> : null}
      {kind === "DERIVED" ? (
        <span className="shrink-0 border-l border-border pl-1.5 text-text-subtle">Derived</span>
      ) : null}
    </Link>
  );
}

export function conditionScoreTone(score: number): Exclude<StatusTone, "neutral"> {
  if (score <= 1.9) {
    return "success";
  }
  if (score <= 2.4) {
    return "info";
  }
  if (score <= 2.9) {
    return "warning";
  }
  return "critical";
}
