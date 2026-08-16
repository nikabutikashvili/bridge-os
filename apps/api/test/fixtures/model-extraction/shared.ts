import type { ExtractedEvidence } from "@bridge-os/contracts";

export function citation(
  pageNumber: number,
  sourceExcerpt: string,
  confidence = 0.96
): ExtractedEvidence {
  return {
    boundingBox: null,
    confidence,
    derivationMethod: null,
    kind: "SOURCE_FACT",
    pageNumber,
    sourceExcerpt
  };
}

export function sourced<T>(
  value: T,
  pageNumber: number,
  sourceExcerpt: string
): { readonly evidence: readonly ExtractedEvidence[]; readonly value: T } {
  return { evidence: [citation(pageNumber, sourceExcerpt)], value };
}

export function missing(): {
  readonly evidence: readonly [];
  readonly value: null;
} {
  return { evidence: [], value: null };
}
