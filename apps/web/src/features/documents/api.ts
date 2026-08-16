import {
  documentOverviewResponseSchema,
  errorEnvelopeSchema,
  type DocumentOverviewResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getDocumentOverview(): Promise<DocumentOverviewResponse> {
  const url = new URL(
    "/api/v1/documents/overview",
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const response = await fetch(url, { next: { revalidate: 30 } });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const error = errorEnvelopeSchema.safeParse(payload);
    const detail = error.success
      ? `${error.data.error.code}: ${error.data.error.message}`
      : `HTTP ${String(response.status)}`;
    throw new Error(`Unable to load document data quality. ${detail}`);
  }
  return documentOverviewResponseSchema.parse(await response.json());
}
