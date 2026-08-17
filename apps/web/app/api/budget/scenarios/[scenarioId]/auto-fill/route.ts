import {
  autoFillBudgetScenarioSchema,
  budgetScenarioParamsSchema
} from "@bridge-os/contracts";

import { forwardBudgetMutation } from "../../../../../../src/features/budget/forward";

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ scenarioId: string }> }
): Promise<Response> {
  const { scenarioId } = budgetScenarioParamsSchema.parse(await context.params);
  const input = autoFillBudgetScenarioSchema.parse(await request.json());
  return forwardBudgetMutation({
    body: input,
    method: "POST",
    path: `/api/v1/budget/scenarios/${scenarioId}/auto-fill`
  });
}
