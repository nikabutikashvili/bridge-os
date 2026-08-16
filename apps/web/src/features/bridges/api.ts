import {
  bridgeDetailResponseSchema,
  bridgeDocumentsResponseSchema,
  bridgeFindingDetailResponseSchema,
  bridgeFindingsResponseSchema,
  bridgeHistoryResponseSchema,
  bridgeInspectionsResponseSchema,
  bridgePortfolioResponseSchema,
  bridgeRecommendationsResponseSchema,
  errorEnvelopeSchema,
  type BridgeDetailResponse,
  type BridgeDocumentsResponse,
  type BridgeFindingDetailResponse,
  type BridgeFindingsResponse,
  type BridgeHistoryResponse,
  type BridgeInspectionsResponse,
  type BridgePortfolioQuery,
  type BridgePortfolioResponse,
  type BridgeRecommendationsResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getBridgePortfolio(
  query: BridgePortfolioQuery
): Promise<BridgePortfolioResponse> {
  const url = new URL("/api/v1/bridges", getWebEnv().NEXT_PUBLIC_API_URL);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, { next: { revalidate: 30 } });
  await assertSuccessful(response, "bridge portfolio");
  return bridgePortfolioResponseSchema.parse(await response.json());
}

export async function getBridgeDetail(
  bridgeId: string
): Promise<BridgeDetailResponse | null> {
  const url = new URL(
    `/api/v1/bridges/${encodeURIComponent(bridgeId)}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const response = await fetch(url, { next: { revalidate: 30 } });

  if (response.status === 404) {
    return null;
  }
  await assertSuccessful(response, "bridge overview");
  return bridgeDetailResponseSchema.parse(await response.json());
}

export function getBridgeInspections(
  bridgeId: string
): Promise<BridgeInspectionsResponse | null> {
  return getBridgeResource(
    bridgeId,
    "inspections",
    bridgeInspectionsResponseSchema,
    "bridge inspections"
  );
}

export function getBridgeFindings(
  bridgeId: string
): Promise<BridgeFindingsResponse | null> {
  return getBridgeResource(
    bridgeId,
    "findings",
    bridgeFindingsResponseSchema,
    "bridge findings"
  );
}

export function getBridgeFindingDetail(
  bridgeId: string,
  findingId: string
): Promise<BridgeFindingDetailResponse | null> {
  return getBridgeResource(
    bridgeId,
    `findings/${encodeURIComponent(findingId)}`,
    bridgeFindingDetailResponseSchema,
    "bridge finding detail"
  );
}

export function getBridgeRecommendations(
  bridgeId: string
): Promise<BridgeRecommendationsResponse | null> {
  return getBridgeResource(
    bridgeId,
    "recommendations",
    bridgeRecommendationsResponseSchema,
    "bridge recommendations"
  );
}

export function getBridgeHistory(
  bridgeId: string
): Promise<BridgeHistoryResponse | null> {
  return getBridgeResource(
    bridgeId,
    "history",
    bridgeHistoryResponseSchema,
    "bridge history"
  );
}

export function getBridgeDocuments(
  bridgeId: string
): Promise<BridgeDocumentsResponse | null> {
  return getBridgeResource(
    bridgeId,
    "documents",
    bridgeDocumentsResponseSchema,
    "bridge documents"
  );
}

interface ResponseParser<Response> {
  readonly parse: (value: unknown) => Response;
}

async function getBridgeResource<Response>(
  bridgeId: string,
  path: string,
  parser: ResponseParser<Response>,
  resource: string
): Promise<Response | null> {
  const url = new URL(
    `/api/v1/bridges/${encodeURIComponent(bridgeId)}/${path}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const response = await fetch(url, { next: { revalidate: 30 } });
  if (response.status === 404) {
    return null;
  }
  await assertSuccessful(response, resource);
  return parser.parse(await response.json());
}

async function assertSuccessful(
  response: Response,
  resource: string
): Promise<void> {
  if (response.ok) {
    return;
  }

  const payload: unknown = await response.json().catch(() => null);
  const error = errorEnvelopeSchema.safeParse(payload);
  const detail = error.success
    ? `${error.data.error.code}: ${error.data.error.message}`
    : `HTTP ${String(response.status)}`;
  throw new Error(`Unable to load ${resource}. ${detail}`);
}
