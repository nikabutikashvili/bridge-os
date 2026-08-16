import { createPlannedInterventionSchema } from "@bridge-os/contracts";

import { getWebEnv } from "../../../../src/config/env";
import { revalidateWorkspace } from "../../../../src/lib/revalidate";

export async function POST(request: Request): Promise<Response> {
  const input = createPlannedInterventionSchema.parse(await request.json());
  const url = new URL(
    "/api/v1/planning/interventions",
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const upstream = await fetch(url, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST"
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
