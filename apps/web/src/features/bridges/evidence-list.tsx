import type { EvidenceCitation } from "@bridge-os/contracts";

import { ProvenanceLink } from "../../components/ui/data-display";

interface EvidenceListProps {
  readonly bridgeId: string;
  readonly citations: readonly EvidenceCitation[];
  readonly emptyLabel?: string;
  readonly limit?: number;
}

export function EvidenceList({
  bridgeId,
  citations,
  emptyLabel = "No field-level evidence linked",
  limit
}: EvidenceListProps): React.ReactElement {
  const visible = limit === undefined ? citations : citations.slice(0, limit);
  if (visible.length === 0) {
    return <span className="text-[10px] not-italic leading-[15px] text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <ul className="m-0 grid min-w-0 list-none gap-1 p-0">
      {visible.map((citation) => (
        <li className="grid min-w-0 gap-0.5" key={`${citation.evidenceId}-${citation.fieldName}`}>
          <ProvenanceLink
            documentName={citation.originalFilename}
            fieldLabel={citation.fieldName}
            href={`/bridges/${bridgeId}?tab=documents#document-${citation.documentId}`}
            kind={citation.kind}
            pageNumber={citation.pageNumber}
          />
          {citation.excerpt ? (
            <q className="line-clamp-2 text-[9px] leading-[14px] text-muted-foreground before:content-none after:content-none">
              {citation.excerpt}
            </q>
          ) : null}
        </li>
      ))}
      {limit !== undefined && citations.length > limit ? (
        <li className="text-[10px] leading-[15px] text-muted-foreground">
          +{String(citations.length - limit)} more citations
        </li>
      ) : null}
    </ul>
  );
}
