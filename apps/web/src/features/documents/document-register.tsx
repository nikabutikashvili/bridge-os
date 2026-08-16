import type {
  DocumentOverviewItem,
  DocumentOverviewResponse
} from "@bridge-os/contracts";
import { FileText, Link2Off } from "lucide-react";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { StatusBadge } from "../../components/ui/data-display";
import { EmptyState } from "../../components/ui/feedback";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../../components/ui/table";
import { formatGermanDate } from "../../lib/formatters";

export function DocumentRegister({
  documents
}: {
  readonly documents: DocumentOverviewResponse["documents"];
}): React.ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableCaption>Document records with processing and extraction state</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[16rem]">Document</TableHead>
            <TableHead className="min-w-[14rem]">Object</TableHead>
            <TableHead className="w-16 text-right">Pages</TableHead>
            <TableHead className="w-[9.5rem]">Processing</TableHead>
            <TableHead className="min-w-[11rem]">Extraction</TableHead>
            <TableHead className="min-w-[10rem]">Errors</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length > 0 ? (
            documents.map((document) => (
              <DocumentRow document={document} key={document.id} />
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell className="h-[220px] p-0" colSpan={6}>
                <EmptyState
                  compact
                  description="Upload or seed a Bauwerksbuch record to begin tracking document state."
                  icon={<FileText size={20} strokeWidth={1.6} />}
                  title="No document records"
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function DocumentRow({
  document
}: {
  readonly document: DocumentOverviewItem;
}): React.ReactElement {
  return (
    <TableRow>
      <TableCell>
        <span
          className="block truncate text-[12px]"
          title={document.originalFilename}
        >
          {document.originalFilename}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {documentTypeLabel(document.type)}
          {" · "}
          {document.isDemoFixture ? "Demo fixture" : "Uploaded PDF"}
          {" · "}
          {formatGermanDate(document.uploadedAt)}
        </span>
      </TableCell>
      <TableCell>
        {document.bridge ? (
          <Link
            className="block min-w-0"
            href={`/bridges/${document.bridge.id}?tab=documents`}
          >
            <span className="block truncate text-[12px] text-foreground hover:underline hover:underline-offset-2">
              {document.bridge.name ?? "Unnamed structure"}
            </span>
            <span className="block truncate font-mono text-[11px] tabular-nums text-muted-foreground">
              {document.bridge.externalStructureNumber ?? "—"}
              {document.bridge.road ? ` · ${document.bridge.road}` : ""}
            </span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link2Off aria-hidden="true" size={13} />
            Not linked
          </span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {document.processing?.pageCount ?? "—"}
      </TableCell>
      <TableCell>
        <ProcessingState document={document} />
      </TableCell>
      <TableCell>
        <ExtractionState document={document} />
      </TableCell>
      <TableCell>
        <DocumentErrors document={document} />
      </TableCell>
    </TableRow>
  );
}

function ProcessingState({ document }: { readonly document: DocumentOverviewItem }): React.ReactElement {
  const processing = document.processing;
  if (processing === null) {
    return (
      <>
        <StatusBadge>{document.isDemoFixture ? "Fixture" : "Not started"}</StatusBadge>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">No run</span>
      </>
    );
  }
  return (
    <>
      <StatusBadge
        tone={
          processing.status === "FAILED"
            ? "critical"
            : processing.status === "EXTRACTED" || processing.status === "EXTRACTION_PENDING"
              ? "success"
              : "info"
        }
      >
        {stateLabel(processing.status)}
      </StatusBadge>
      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
        {processing.parser ?? "Parser not recorded"}
      </span>
    </>
  );
}

function ExtractionState({ document }: { readonly document: DocumentOverviewItem }): React.ReactElement {
  const status = document.extraction.status;
  return (
    <>
      <StatusBadge
        tone={
          status === "FAILED"
            ? "critical"
            : status === "SUCCEEDED"
              ? "success"
              : status === "NOT_STARTED"
                ? "neutral"
                : "info"
        }
      >
        {stateLabel(status)}
      </StatusBadge>
      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
        {extractionDetail(document)}
      </span>
    </>
  );
}

function extractionDetail(document: DocumentOverviewItem): string {
  const extraction = document.extraction;
  if (document.isDemoFixture && extraction.status === "NOT_STARTED") {
    return "Demo data; no extraction run";
  }
  const model = [extraction.pipelineVersion, extraction.provider, extraction.model]
    .filter(Boolean)
    .join(" · ");
  if (model.length > 0) return model;
  if (extraction.attempt === null) return "No run metadata";
  return `Attempt ${String(extraction.attempt)}`;
}

function DocumentErrors({ document }: { readonly document: DocumentOverviewItem }): React.ReactElement {
  const errors = [document.processing?.error ?? null, document.extraction.error].filter(
    (error): error is NonNullable<typeof error> => error !== null
  );
  if (errors.length === 0) {
    return <span className="font-mono text-[11px] text-muted-foreground">None</span>;
  }
  return (
    <div className="grid min-w-0 gap-0.5">
      {errors.map((error) => (
        <Tooltip key={`${error.stage}-${error.code}`}>
          <TooltipTrigger asChild>
            <span className="line-clamp-2 cursor-default font-mono text-[11px] text-critical">
              <strong className="block font-medium">{error.code}</strong>
              {error.message}
            </span>
          </TooltipTrigger>
          <TooltipContent>{error.message}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function documentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    BAUWERKSBUCH: "Bauwerksbuch",
    DEMO_BAUWERKSBUCH: "Bauwerksbuch",
    DEMO_PRUEFBERICHT: "Inspection report",
    PRUEFBERICHT: "Inspection report"
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

function stateLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .toLocaleLowerCase("en-US")
    .replace(/^./u, (character) => character.toLocaleUpperCase("en-US"));
}
