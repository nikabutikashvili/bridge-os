import {
  budgetScenarioParamsSchema,
  updateBudgetScenarioSchema
} from "@bridge-os/contracts";

import { forwardBudgetMutation } from "../../../../../src/features/budget/forward";

export async function PATCH(
  request: Request,
  context: { readonly params: Promise<{ scenarioId: string }> }
): Promise<Response> {
  const { scenarioId } = budgetScenarioParamsSchema.parse(await context.params);
  const input = updateBudgetScenarioSchema.parse(await request.json());
  return forwardBudgetMutation({
    body: input,
    method: "PATCH",
    path: `/api/v1/budget/scenarios/${scenarioId}`
  });
}

export async function DELETE(
  _request: Request,
  context: { readonly params: Promise<{ scenarioId: string }> }
): Promise<Response> {
  const { scenarioId } = budgetScenarioParamsSchema.parse(await context.params);
  return forwardBudgetMutation({
    method: "DELETE",
    path: `/api/v1/budget/scenarios/${scenarioId}`
  });
}
