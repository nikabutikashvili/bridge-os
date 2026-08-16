import type {
  BridgeDocumentsResponse,
  BridgeFindingDetailResponse,
  BridgeFindingsResponse,
  BridgeHistoryResponse,
  BridgeInspectionsResponse,
  BridgeRecommendationsResponse
} from "@bridge-os/contracts";
import { uuidSchema } from "@bridge-os/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbOverride } from "../../../src/components/shell/breadcrumb-context";
import { BridgeDetailHeader } from "../../../src/features/bridges/bridge-detail-header";
import { BridgeDetailTabs } from "../../../src/features/bridges/bridge-detail-tabs";
import { DetailOverview } from "../../../src/features/bridges/detail-overview";
import {
  DocumentsTab,
  InspectionsTab,
  RecommendationsTab,
  TechnicalDataTab
} from "../../../src/features/bridges/detail-record-tabs";
import { FindingsExperience } from "../../../src/features/bridges/findings-experience";
import {
  getBridgeDetail,
  getBridgeDocuments,
  getBridgeFindingDetail,
  getBridgeFindings,
  getBridgeHistory,
  getBridgeInspections,
  getBridgeRecommendations
} from "../../../src/features/bridges/api";
import {
  parseBridgeDetailTab,
  type BridgeDetailTab
} from "../../../src/features/bridges/detail-model";

export const metadata: Metadata = { title: "Bridge detail" };

interface BridgeDetailPageProps {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type DetailTabData =
  | {
      readonly history: BridgeHistoryResponse;
      readonly inspections: BridgeInspectionsResponse;
      readonly recommendations: BridgeRecommendationsResponse;
      readonly tab: "overview";
    }
  | { readonly inspections: BridgeInspectionsResponse; readonly tab: "inspections" }
  | {
      readonly findings: BridgeFindingsResponse;
      readonly selectedFinding: BridgeFindingDetailResponse | null;
      readonly tab: "findings";
    }
  | {
      readonly recommendations: BridgeRecommendationsResponse;
      readonly tab: "recommendations";
    }
  | { readonly tab: "technical" }
  | { readonly documents: BridgeDocumentsResponse; readonly tab: "documents" };

export default async function BridgeDetailPage({
  params,
  searchParams
}: BridgeDetailPageProps): Promise<React.ReactElement> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const activeTab = parseBridgeDetailTab(query["tab"]);
  const selectedFindingId = parseFindingId(query["finding"]);
  const [response, tabData] = await Promise.all([
    getBridgeDetail(id),
    loadTabData(id, activeTab, selectedFindingId)
  ]);
  if (response === null) {
    notFound();
  }

  const bridge = response.data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbOverride label={bridge.name ?? "Bridge detail"} />
      <BridgeDetailHeader bridge={bridge} />
      <BridgeDetailTabs activeTab={activeTab} bridgeId={bridge.id} />
      <div className="min-w-0 px-4 py-4">{renderTab(bridge, tabData)}</div>
    </div>
  );
}

async function loadTabData(
  bridgeId: string,
  tab: BridgeDetailTab,
  selectedFindingId: string | null
): Promise<DetailTabData> {
  if (tab === "overview") {
    const [inspections, recommendations, history] = await Promise.all([
      getBridgeInspections(bridgeId),
      getBridgeRecommendations(bridgeId),
      getBridgeHistory(bridgeId)
    ]);
    return {
      history: requireResource(history, "history"),
      inspections: requireResource(inspections, "inspections"),
      recommendations: requireResource(recommendations, "recommendations"),
      tab
    };
  }
  if (tab === "inspections") {
    return {
      inspections: requireResource(
        await getBridgeInspections(bridgeId),
        "inspections"
      ),
      tab
    };
  }
  if (tab === "findings") {
    const [findings, selectedFinding] = await Promise.all([
      getBridgeFindings(bridgeId),
      selectedFindingId === null
        ? Promise.resolve(null)
        : getBridgeFindingDetail(bridgeId, selectedFindingId)
    ]);
    return {
      findings: requireResource(findings, "findings"),
      selectedFinding,
      tab
    };
  }
  if (tab === "recommendations") {
    return {
      recommendations: requireResource(
        await getBridgeRecommendations(bridgeId),
        "recommendations"
      ),
      tab
    };
  }
  if (tab === "documents") {
    return {
      documents: requireResource(await getBridgeDocuments(bridgeId), "documents"),
      tab
    };
  }
  return { tab: "technical" };
}

function renderTab(
  bridge: NonNullable<Awaited<ReturnType<typeof getBridgeDetail>>>["data"],
  data: DetailTabData
): React.ReactElement {
  switch (data.tab) {
    case "overview":
      return (
        <DetailOverview
          bridge={bridge}
          history={data.history.data}
          inspections={data.inspections.data}
          recommendations={data.recommendations.data}
        />
      );
    case "inspections":
      return <InspectionsTab bridgeId={bridge.id} data={data.inspections.data} />;
    case "findings":
      return (
        <FindingsExperience
          bridgeId={bridge.id}
          data={data.findings.data}
          selectedFinding={data.selectedFinding?.data ?? null}
        />
      );
    case "recommendations":
      return (
        <RecommendationsTab
          bridgeId={bridge.id}
          data={data.recommendations.data}
        />
      );
    case "technical":
      return <TechnicalDataTab bridge={bridge} />;
    case "documents":
      return <DocumentsTab bridge={bridge} data={data.documents.data} />;
  }
}

function parseFindingId(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = uuidSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function requireResource<Response>(
  response: Response | null,
  resource: string
): Response {
  if (response === null) {
    throw new Error(`Bridge ${resource} unexpectedly returned not found.`);
  }
  return response;
}
