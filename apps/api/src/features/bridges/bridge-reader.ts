import type {
  BridgeDetailResponse,
  BridgeDocumentsResponse,
  BridgeFindingDetailResponse,
  BridgeFindingsResponse,
  BridgeHistoryResponse,
  BridgeInspectionsResponse,
  BridgePortfolioQuery,
  BridgePortfolioResponse,
  BridgeRecommendationsResponse
} from "@bridge-os/contracts";

export interface BridgePhotoFile {
  readonly mimeType: "image/jpeg";
  readonly storageKey: string;
}

export interface BridgePortfolioReader {
  listBridges(query: BridgePortfolioQuery): Promise<BridgePortfolioResponse>;
  getBridge(id: string): Promise<BridgeDetailResponse | null>;
  getBridgePhoto(id: string): Promise<BridgePhotoFile | null>;
  getFinding(
    bridgeId: string,
    findingId: string
  ): Promise<BridgeFindingDetailResponse | null>;
  getInspections(id: string): Promise<BridgeInspectionsResponse | null>;
  getFindings(id: string): Promise<BridgeFindingsResponse | null>;
  getRecommendations(id: string): Promise<BridgeRecommendationsResponse | null>;
  getHistory(id: string): Promise<BridgeHistoryResponse | null>;
  getDocuments(id: string): Promise<BridgeDocumentsResponse | null>;
}
