import {
  budgetMembershipParamsSchema,
  updateBudgetMembershipSchema
} from "@bridge-os/contracts";

import { getWebEnv } from "../../../../../../src/config/env";
import { revalidateWorkspace } from "../../../../../../src/lib/revalidate";

export async function PUT(
  request: Request,
  context: {
    readonly params: Promise<{ interventionId: string; year: string }>;
  }
): Promise<Response> {
  const { year, interventionId } = budgetMembershipParamsSchema.parse(
    await context.params
  );
  const input = updateBudgetMembershipSchema.parse(await request.json());
  const url = new URL(
    `/api/v1/budget/${String(year)}/interventions/${interventionId}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const upstream = await fetch(url, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "PUT"
  });
  if (upstream.ok) {
    revalidateWorkspace();
  }
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    },
    status: upstream.status
  });
}
