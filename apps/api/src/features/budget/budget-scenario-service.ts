import type {
  AutoFillBudgetScenario,
  BudgetScenarioCompareResponse,
  BudgetScenarioListResponse,
  BudgetScenarioResponse,
  CreateBudgetScenario,
  UpdateBudgetScenario,
  UpdateBudgetScenarioAssignment
} from "@bridge-os/contracts";

export type BudgetScenarioMutationResult =
  | { readonly outcome: "UPDATED"; readonly response: BudgetScenarioResponse }
  | { readonly outcome: "NOT_FOUND"; readonly scenarioId: string };

export type BudgetScenarioAssignmentResult =
  | { readonly outcome: "UPDATED"; readonly response: BudgetScenarioResponse }
  | { readonly outcome: "NOT_FOUND"; readonly scenarioId: string }
  | { readonly outcome: "INTERVENTION_NOT_FOUND"; readonly interventionId: string }
  | {
      readonly outcome: "YEAR_OUT_OF_HORIZON";
      readonly assignedYear: number;
      readonly years: readonly number[];
    };

export type BudgetScenarioUpdateResult =
  | { readonly outcome: "UPDATED"; readonly response: BudgetScenarioResponse }
  | { readonly outcome: "NOT_FOUND"; readonly scenarioId: string }
  | {
      readonly outcome: "YEAR_OUT_OF_HORIZON";
      readonly year: number;
      readonly years: readonly number[];
    };

export type BudgetScenarioCompareResult =
  | { readonly outcome: "COMPARED"; readonly response: BudgetScenarioCompareResponse }
  | { readonly outcome: "NOT_FOUND"; readonly scenarioId: string };

export interface BudgetScenarioService {
  list(): Promise<BudgetScenarioListResponse>;
  get(scenarioId: string): Promise<BudgetScenarioResponse | null>;
  create(input: CreateBudgetScenario): Promise<BudgetScenarioResponse>;
  update(
    scenarioId: string,
    input: UpdateBudgetScenario
  ): Promise<BudgetScenarioUpdateResult>;
  remove(scenarioId: string): Promise<{ readonly outcome: "DELETED" | "NOT_FOUND" }>;
  updateAssignment(
    scenarioId: string,
    interventionId: string,
    input: UpdateBudgetScenarioAssignment
  ): Promise<BudgetScenarioAssignmentResult>;
  autoFill(
    scenarioId: string,
    input: AutoFillBudgetScenario
  ): Promise<BudgetScenarioMutationResult>;
  adopt(scenarioId: string): Promise<BudgetScenarioMutationResult>;
  compare(
    leftId: string,
    rightId: string
  ): Promise<BudgetScenarioCompareResult>;
}
