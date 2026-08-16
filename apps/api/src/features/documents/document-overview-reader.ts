import type { DocumentOverviewResponse } from "@bridge-os/contracts";

export interface DocumentOverviewReader {
  listOverview(): Promise<DocumentOverviewResponse>;
}
