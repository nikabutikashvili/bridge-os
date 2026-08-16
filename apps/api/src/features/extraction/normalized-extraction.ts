import type {
  CreateBridge,
  CreateComponent,
  CreateFinding,
  CreateHistoricalWork,
  CreateInspection,
  CreatePartialStructure,
  CreateRecommendation,
  CreateTrafficObservation,
  ExtractedEvidence
} from "@bridge-os/contracts";

export type FieldEvidence = Readonly<
  Record<string, readonly ExtractedEvidence[]>
>;

interface NormalizedRecord<TValues> {
  readonly evidence: readonly ExtractedEvidence[];
  readonly fieldEvidence: FieldEvidence;
  readonly sourceKey: string;
  readonly values: TValues;
}

export interface NormalizedBridge {
  readonly evidence: readonly ExtractedEvidence[];
  readonly fieldEvidence: FieldEvidence;
  readonly values: CreateBridge;
}

export type NormalizedPartialStructure = NormalizedRecord<
  Omit<CreatePartialStructure, "bridgeId">
>;

export interface NormalizedComponent
  extends NormalizedRecord<Omit<CreateComponent, "bridgeId" | "partialStructureId">> {
  readonly partialStructureRef: string;
}

export interface NormalizedInspection
  extends NormalizedRecord<
    Omit<CreateInspection, "bridgeId" | "partialStructureId">
  > {
  readonly partialStructureRef: string;
}

export interface NormalizedFinding
  extends NormalizedRecord<
    Omit<
      CreateFinding,
      "bridgeId" | "componentId" | "inspectionId" | "partialStructureId"
    >
  > {
  readonly componentRef: string | null;
  readonly inspectionRef: string;
  readonly partialStructureRef: string;
}

export interface NormalizedRecommendation
  extends NormalizedRecord<
    Omit<CreateRecommendation, "bridgeId" | "partialStructureId">
  > {
  readonly linkedFindingRefs: readonly string[];
  readonly partialStructureRef: string;
}

export interface NormalizedHistoricalWork
  extends NormalizedRecord<
    Omit<CreateHistoricalWork, "bridgeId" | "partialStructureId">
  > {
  readonly partialStructureRef: string | null;
}

export type NormalizedTrafficObservation = NormalizedRecord<
  Omit<CreateTrafficObservation, "bridgeId">
>;

export interface NormalizedExtractionBundle {
  readonly bridge: NormalizedBridge;
  readonly components: readonly NormalizedComponent[];
  readonly findings: readonly NormalizedFinding[];
  readonly historicalWorks: readonly NormalizedHistoricalWork[];
  readonly inspections: readonly NormalizedInspection[];
  readonly partialStructures: readonly NormalizedPartialStructure[];
  readonly recommendations: readonly NormalizedRecommendation[];
  readonly trafficObservations: readonly NormalizedTrafficObservation[];
}
