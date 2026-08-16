import type {
  CreatePlannedIntervention,
  CreatePlannedInterventionResponse,
  PlanningQuery,
  PlanningResponse
} from "@bridge-os/contracts";

export type CreateInterventionResult =
  | {
      readonly outcome: "CREATED";
      readonly response: CreatePlannedInterventionResponse;
    }
  | {
      readonly outcome: "RECOMMENDATION_NOT_FOUND";
      readonly recommendationId: string;
    }
  | {
      readonly outcome: "RECOMMENDATION_NOT_ACTIONABLE";
      readonly recommendationId: string;
    }
  | {
      readonly interventionId: string;
      readonly outcome: "INTERVENTION_ALREADY_EXISTS";
      readonly recommendationId: string;
    };

export interface PlanningService {
  list(query: PlanningQuery): Promise<PlanningResponse>;
  createFromRecommendation(
    input: CreatePlannedIntervention
  ): Promise<CreateInterventionResult>;
}
