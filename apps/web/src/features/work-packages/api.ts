import {
  errorEnvelopeSchema,
  workPackageDetailResponseSchema,
  workPackageListResponseSchema,
  type WorkPackageDetailResponse,
  type WorkPackageListResponse
} from "@bridge-os/contracts";

import { getWebEnv } from "../../config/env";

export async function getWorkPackages(): Promise<WorkPackageListResponse> {
  const url = new URL(
    "/api/v1/work-packages",
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const response = await fetch(url, { next: { revalidate: 30 } });
  await assertSuccessful(response, "work packages");
  return workPackageListResponseSchema.parse(await response.json());
}

export async function getWorkPackage(
  id: string
): Promise<WorkPackageDetailResponse | null> {
  const url = new URL(
    `/api/v1/work-packages/${encodeURIComponent(id)}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const response = await fetch(url, { next: { revalidate: 30 } });
  if (response.status === 404) return null;
  await assertSuccessful(response, "work package");
  return workPackageDetailResponseSchema.parse(await response.json());
}

async function assertSuccessful(
  response: Response,
  resource: string
): Promise<void> {
  if (response.ok) return;
  const payload: unknown = await response.json().catch(() => null);
  const error = errorEnvelopeSchema.safeParse(payload);
  const detail = error.success
    ? `${error.data.error.code}: ${error.data.error.message}`
    : `HTTP ${String(response.status)}`;
  throw new Error(`Unable to load ${resource}. ${detail}`);
}
