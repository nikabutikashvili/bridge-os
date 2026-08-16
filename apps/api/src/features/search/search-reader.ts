import type {
  GlobalSearchQuery,
  GlobalSearchResponse
} from "@bridge-os/contracts";

export interface GlobalSearchReader {
  search(query: GlobalSearchQuery): Promise<GlobalSearchResponse>;
}
