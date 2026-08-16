import type {
  CreateWorkPackage,
  WorkPackageDetailResponse,
  WorkPackageListResponse
} from "@bridge-os/contracts";

export type CreateWorkPackageResult =
  | { readonly outcome: "CREATED"; readonly response: WorkPackageDetailResponse }
  | {
      readonly outcome: "INTERVENTION_NOT_FOUND";
      readonly plannedInterventionId: string;
    }
  | {
      readonly outcome: "INTERVENTION_NOT_ACTIONABLE";
      readonly plannedInterventionId: string;
    }
  | {
      readonly outcome: "WORK_PACKAGE_ALREADY_EXISTS";
      readonly plannedInterventionId: string;
      readonly workPackageId: string;
    };

export type DeleteWorkPackageResult =
  | { readonly outcome: "DELETED"; readonly plannedInterventionId: string }
  | { readonly outcome: "WORK_PACKAGE_NOT_FOUND"; readonly workPackageId: string };

export interface WorkPackageService {
  list(): Promise<WorkPackageListResponse>;
  get(id: string): Promise<WorkPackageDetailResponse | null>;
  create(input: CreateWorkPackage): Promise<CreateWorkPackageResult>;
  remove(id: string): Promise<DeleteWorkPackageResult>;
}
