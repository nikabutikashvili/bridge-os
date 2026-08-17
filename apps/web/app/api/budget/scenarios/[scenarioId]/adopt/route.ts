import { budgetScenarioParamsSchema } from "@bridge-os/contracts";

import { forwardBudgetMutation } from "../../../../../../src/features/budget/forward";

export async function POST(
  _request: Request,
  context: { readonly params: Promise<{ scenarioId: string }> }
): Promise<Response> {
  const { scenarioId } = budgetScenarioParamsSchema.parse(await context.params);
  return forwardBudgetMutation({
    method: "POST",
    path: `/api/v1/budget/scenarios/${scenarioId}/adopt`
  });
}
