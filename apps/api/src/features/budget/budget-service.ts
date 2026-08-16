import type {
  BudgetQuery,
  BudgetResponse,
  UpdateBudget,
  UpdateBudgetMembership
} from "@bridge-os/contracts";

export type UpdateBudgetMembershipResult =
  | { readonly outcome: "UPDATED"; readonly response: BudgetResponse }
  | { readonly outcome: "INTERVENTION_NOT_FOUND"; readonly interventionId: string }
  | {
      readonly outcome: "INTERVENTION_YEAR_MISMATCH";
      readonly interventionId: string;
      readonly interventionYear: number;
      readonly requestedYear: number;
    };

export interface BudgetService {
  get(query: BudgetQuery): Promise<BudgetResponse>;
  updateBudget(year: number, input: UpdateBudget): Promise<BudgetResponse>;
  updateMembership(
    year: number,
    interventionId: string,
    input: UpdateBudgetMembership
  ): Promise<UpdateBudgetMembershipResult>;
}
