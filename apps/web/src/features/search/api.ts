import {
  globalSearchResponseSchema,
  type GlobalSearchResponse
} from "@bridge-os/contracts";

export async function searchGlobalRecords(
  query: string,
  signal: AbortSignal
): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams({ limit: "5", q: query });
  const response = await fetch(`/api/search?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`Global search failed with status ${String(response.status)}.`);
  }
  return globalSearchResponseSchema.parse(await response.json());
}
