import type { BridgeDetailResponse, InspectionDueStatus } from "@bridge-os/contracts";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "../../components/ui/data-display";
import { cn } from "@/lib/utils";
import { absoluteApiUrl } from "../../lib/api-url";
import { formatConditionScore, formatGermanDate } from "../../lib/formatters";
import { BridgePhoto } from "./bridge-photo";
import {
  attentionLabel,
  attentionReasonLabel,
  attentionTone,
  inspectionDueTone,
  urgencyLabel
} from "./detail-labels";

interface BridgeDetailHeaderProps {
  readonly bridge: BridgeDetailResponse["data"];
}

export function BridgeDetailHeader({
  bridge
}: BridgeDetailHeaderProps): React.ReactElement {
  const reasons = bridge.attention.reasons;
  const location =
    [bridge.location.municipality, bridge.location.locality].filter(Boolean).join(" · ") ||
    "Location not recorded";

  return (
    <header className="shrink-0">
      <div className="flex items-start justify-between gap-6 px-4 pt-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {bridge.photoUrl ? (
            <BridgePhoto
              alt={`Photograph of ${bridge.name ?? "this structure"}`}
              src={absoluteApiUrl(bridge.photoUrl)}
              variant="header"
            />
          ) : null}
          <div className="grid min-w-0 gap-1.5">
            <Link
              className="flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-muted-foreground hover:text-foreground"
              href="/bridges"
            >
              <ArrowLeft aria-hidden="true" size={12} />
              OBJECT SET
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 text-[18px] font-medium leading-6 tracking-tight">
                {bridge.name ?? "Unnamed structure"}
              </h1>
              <StatusBadge tone={attentionTone(bridge.attention.level)}>
                {attentionLabel(bridge.attention.level)}
              </StatusBadge>
              {bridge.dataOrigin === "DEMO_FIXTURE" ? (
                <StatusBadge tone="info">Demo</StatusBadge>
              ) : null}
            </div>
            <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {bridge.externalStructureNumber ?? "No structure number"}
              </span>
              {bridge.road ? <span>{bridge.road}</span> : null}
              <span className="inline-flex items-center gap-1 font-sans">
                <MapPin aria-hidden="true" size={12} />
                {location}
              </span>
            </p>
            <p
              className="m-0 max-w-[52rem] text-[12px] leading-4 text-muted-foreground"
              title={reasons.map(attentionReasonLabel).join("; ")}
            >
              {reasons.length === 0
                ? "No active attention reason."
                : reasons.map(attentionReasonLabel).join(" · ")}
            </p>
          </div>
        </div>
      </div>

      <section
        aria-label="Bridge headline facts"
        className="grid grid-cols-4 gap-3 px-4 pt-4"
      >
        <HudStat
          detail={
            bridge.condition.trend === "DETERIORATING"
              ? "Worsening · lower is better"
              : "Lower is better"
          }
          label="Condition"
          tone={conditionTone(bridge.condition.score)}
          value={formatConditionScore(bridge.condition.score)}
        />
        <HudStat
          detail={formatGermanDate(bridge.inspection.latestInspectionOn)}
          label="Inspection"
          tone={inspectionDueTone(bridge.inspection.status)}
          value={inspectionDueHudValue(bridge.inspection.status)}
        />
        <HudStat
          detail="Unresolved findings"
          label="Open findings"
          tone={bridge.attention.openFindings > 0 ? "warning" : "ok"}
          value={bridge.attention.openFindings}
        />
        <HudStat
          detail={
            bridge.attention.openRecommendations > 0
              ? urgencyLabel(bridge.attention.highestRecommendationUrgency)
              : "None unresolved"
          }
          label="Open recs"
          tone={bridge.attention.openRecommendations > 0 ? "warning" : "ok"}
          value={bridge.attention.openRecommendations}
        />
      </section>
    </header>
  );
}

function HudStat({
  detail,
  label,
  tone = "ok",
  value
}: {
  readonly detail: string;
  readonly label: string;
  readonly tone?: "critical" | "info" | "neutral" | "ok" | "success" | "warning";
  readonly value: React.ReactNode;
}): React.ReactElement {
  const bar = tone === "critical" || tone === "warning" ? tone : "ok";

  return (
    <div
      className={cn(
        "grid min-w-0 gap-1.5 border border-border-strong bg-card px-4 py-3",
        bar === "critical" && "border-l-[3px] border-l-critical",
        bar === "warning" && "border-l-[3px] border-l-warning"
      )}
    >
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-chrome">
        {label}
      </span>
      <span
        className={cn(
          "truncate font-mono text-[34px] font-medium leading-none tabular-nums tracking-tight",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          (tone === "ok" || tone === "neutral" || tone === "info") && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="truncate text-[12px] leading-4 text-muted-foreground">{detail}</span>
    </div>
  );
}

function inspectionDueHudValue(status: InspectionDueStatus): string {
  const labels: Record<InspectionDueStatus, string> = {
    CURRENT: "CURRENT",
    DUE_SOON: "DUE SOON",
    OVERDUE: "OVERDUE",
    UNKNOWN: "UNKNOWN"
  };
  return labels[status];
}

function conditionTone(
  score: number | string | null | undefined
): "critical" | "ok" | "success" | "warning" {
  if (score === null || score === undefined) return "ok";
  const numeric = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(numeric)) return "ok";
  if (numeric <= 1.9) return "success";
  if (numeric <= 2.4) return "ok";
  if (numeric <= 2.9) return "warning";
  return "critical";
}
