import {
  budgetYearParamsSchema,
  updateBudgetSchema
} from "@bridge-os/contracts";

import { getWebEnv } from "../../../../src/config/env";
import { revalidateWorkspace } from "../../../../src/lib/revalidate";

export async function PUT(
  request: Request,
  context: { readonly params: Promise<{ year: string }> }
): Promise<Response> {
  const { year } = budgetYearParamsSchema.parse(await context.params);
  const input = updateBudgetSchema.parse(await request.json());
  const url = new URL(
    `/api/v1/budget/${String(year)}`,
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
