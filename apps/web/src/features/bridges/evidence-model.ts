import type { EvidenceCitation } from "@bridge-os/contracts";

export interface EvidenceAssociation {
  readonly derivationMethod: string | null;
  readonly fieldName: string;
  readonly kind: EvidenceCitation["kind"];
}

export interface EvidenceSourceGroup {
  readonly associations: EvidenceAssociation[];
  readonly boundingBox: EvidenceCitation["boundingBox"];
  readonly documentId: string;
  readonly documentType: string;
  readonly evidenceId: string;
  readonly excerpt: string | null;
  readonly extractionConfidence: string | null;
  readonly extractionMethod: EvidenceCitation["extractionMethod"];
  readonly originalFilename: string;
  readonly pageNumber: number | null;
  readonly reviewState: EvidenceCitation["reviewState"];
  readonly viewSourceUrl: string | null;
}

export type FieldProvenanceKind =
  | "DERIVED"
  | "MIXED"
  | "SOURCE_FACT"
  | "UNLINKED";

export interface FieldProvenance {
  readonly derivationMethods: string[];
  readonly kind: FieldProvenanceKind;
}

export function groupEvidenceSources(
  citations: readonly EvidenceCitation[]
): EvidenceSourceGroup[] {
  const groups = new Map<string, EvidenceSourceGroup>();

  for (const citation of citations) {
    const existing = groups.get(citation.evidenceId);
    if (existing === undefined) {
      groups.set(citation.evidenceId, {
        associations: [associationFromCitation(citation)],
        boundingBox: citation.boundingBox,
        documentId: citation.documentId,
        documentType: citation.documentType,
        evidenceId: citation.evidenceId,
        excerpt: citation.excerpt,
        extractionConfidence: citation.extractionConfidence,
        extractionMethod: citation.extractionMethod,
        originalFilename: citation.originalFilename,
        pageNumber: citation.pageNumber,
        reviewState: citation.reviewState,
        viewSourceUrl: citation.viewSourceUrl
      });
      continue;
    }

    assertSameSource(existing, citation);
    const association = associationFromCitation(citation);
    const duplicate = existing.associations.some(
      (item) =>
        item.fieldName === association.fieldName &&
        item.kind === association.kind &&
        item.derivationMethod === association.derivationMethod
    );
    if (!duplicate) {
      existing.associations.push(association);
    }
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.originalFilename.localeCompare(right.originalFilename) ||
      (left.pageNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.pageNumber ?? Number.MAX_SAFE_INTEGER)
  );
}

export function getFieldProvenance(
  citations: readonly EvidenceCitation[],
  fieldNames: readonly string[]
): FieldProvenance {
  const relevant = citations.filter((citation) =>
    fieldNames.includes(citation.fieldName)
  );
  if (relevant.length === 0) {
    return { derivationMethods: [], kind: "UNLINKED" };
  }

  const kinds = new Set(relevant.map((citation) => citation.kind));
  const derivationMethods = [
    ...new Set(
      relevant.flatMap((citation) =>
        citation.derivationMethod === null ? [] : [citation.derivationMethod]
      )
    )
  ];

  return {
    derivationMethods,
    kind:
      kinds.size > 1
        ? "MIXED"
        : relevant[0]?.kind === "DERIVED"
          ? "DERIVED"
          : "SOURCE_FACT"
  };
}

function associationFromCitation(citation: EvidenceCitation): EvidenceAssociation {
  return {
    derivationMethod: citation.derivationMethod,
    fieldName: citation.fieldName,
    kind: citation.kind
  };
}

function assertSameSource(
  group: EvidenceSourceGroup,
  citation: EvidenceCitation
): void {
  const comparableGroup = JSON.stringify({
    boundingBox: group.boundingBox,
    documentId: group.documentId,
    documentType: group.documentType,
    excerpt: group.excerpt,
    extractionConfidence: group.extractionConfidence,
    extractionMethod: group.extractionMethod,
    originalFilename: group.originalFilename,
    pageNumber: group.pageNumber,
    reviewState: group.reviewState,
    viewSourceUrl: group.viewSourceUrl
  });
  const comparableCitation = JSON.stringify({
    boundingBox: citation.boundingBox,
    documentId: citation.documentId,
    documentType: citation.documentType,
    excerpt: citation.excerpt,
    extractionConfidence: citation.extractionConfidence,
    extractionMethod: citation.extractionMethod,
    originalFilename: citation.originalFilename,
    pageNumber: citation.pageNumber,
    reviewState: citation.reviewState,
    viewSourceUrl: citation.viewSourceUrl
  });

  if (comparableGroup !== comparableCitation) {
    throw new Error(`Conflicting source metadata for evidence ${citation.evidenceId}.`);
  }
}
