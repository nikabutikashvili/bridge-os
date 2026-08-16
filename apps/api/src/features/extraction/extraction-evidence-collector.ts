import { randomUUID } from "node:crypto";

import type { ExtractedEvidence } from "@bridge-os/contracts";
import type { sourceEvidence } from "@bridge-os/db";

import type { FieldEvidence } from "./normalized-extraction.js";

type SourceEvidenceInsert = typeof sourceEvidence.$inferInsert;

interface EvidenceLink {
  readonly derivationMethod: string | null;
  readonly evidenceId: string;
  readonly fieldName: string;
  readonly kind: "DERIVED" | "SOURCE_FACT";
}

export class EvidenceCollector {
  private readonly rows = new Map<string, SourceEvidenceInsert>();

  public constructor(
    private readonly documentId: string,
    private readonly runId: string
  ) {}

  public get evidenceRows(): SourceEvidenceInsert[] {
    return [...this.rows.values()];
  }

  public links(
    recordEvidence: readonly ExtractedEvidence[],
    fieldEvidence: FieldEvidence
  ): EvidenceLink[] {
    const links: EvidenceLink[] = [];
    const seen = new Set<string>();
    this.collectField("$", recordEvidence, links, seen);
    for (const [fieldName, citations] of Object.entries(fieldEvidence)) {
      this.collectField(fieldName, citations, links, seen);
    }
    return links;
  }

  private collectField(
    fieldName: string,
    citations: readonly ExtractedEvidence[],
    links: EvidenceLink[],
    seen: Set<string>
  ): void {
    for (const citation of citations) {
      const evidenceId = this.evidenceId(citation);
      const key = `${fieldName}:${evidenceId}:${citation.kind}:${citation.derivationMethod ?? ""}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      links.push({
        derivationMethod: citation.derivationMethod,
        evidenceId,
        fieldName,
        kind: citation.kind
      });
    }
  }

  private evidenceId(citation: ExtractedEvidence): string {
    const key = JSON.stringify({
      boundingBox: citation.boundingBox,
      confidence: citation.confidence,
      pageNumber: citation.pageNumber,
      sourceExcerpt: citation.sourceExcerpt
    });
    const existing = this.rows.get(key);
    if (existing?.id !== undefined) {
      return existing.id;
    }
    const id = randomUUID();
    this.rows.set(key, {
      id,
      boundingBoxHeight: citation.boundingBox?.height ?? null,
      boundingBoxWidth: citation.boundingBox?.width ?? null,
      boundingBoxX: citation.boundingBox?.x ?? null,
      boundingBoxY: citation.boundingBox?.y ?? null,
      documentId: this.documentId,
      extractionConfidence:
        citation.confidence === null ? null : citation.confidence.toFixed(3),
      extractionMethod: "MODEL_EXTRACTION",
      extractionRunId: this.runId,
      pageNumber: citation.pageNumber,
      reviewState: "AUTOMATICALLY_EXTRACTED",
      sourceExcerpt: citation.sourceExcerpt
    });
    return id;
  }
}
