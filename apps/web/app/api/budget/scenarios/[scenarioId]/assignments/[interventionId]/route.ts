import {
  budgetScenarioAssignmentParamsSchema,
  updateBudgetScenarioAssignmentSchema
} from "@bridge-os/contracts";

import { forwardBudgetMutation } from "../../../../../../../src/features/budget/forward";

export async function PUT(
  request: Request,
  context: { readonly params: Promise<{ scenarioId: string; interventionId: string }> }
): Promise<Response> {
  const { scenarioId, interventionId } =
    budgetScenarioAssignmentParamsSchema.parse(await context.params);
  const input = updateBudgetScenarioAssignmentSchema.parse(await request.json());
  return forwardBudgetMutation({
    body: input,
    method: "PUT",
    path: `/api/v1/budget/scenarios/${scenarioId}/assignments/${interventionId}`
  });
}
