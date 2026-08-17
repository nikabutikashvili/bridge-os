import { createBudgetScenarioSchema } from "@bridge-os/contracts";

import { forwardBudgetMutation } from "../../../../src/features/budget/forward";

export async function POST(request: Request): Promise<Response> {
  const input = createBudgetScenarioSchema.parse(await request.json());
  return forwardBudgetMutation({
    body: input,
    method: "POST",
    path: "/api/v1/budget/scenarios"
  });
}
