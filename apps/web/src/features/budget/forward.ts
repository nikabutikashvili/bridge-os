import { getWebEnv } from "../../config/env";
import { revalidateWorkspace } from "../../lib/revalidate";

export async function forwardBudgetMutation(options: {
  readonly path: string;
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  readonly body?: unknown;
}): Promise<Response> {
  const url = new URL(options.path, getWebEnv().NEXT_PUBLIC_API_URL);
  const upstream = await fetch(url, {
    method: options.method,
    ...(options.body === undefined
      ? {}
      : {
          body: JSON.stringify(options.body),
          headers: { "content-type": "application/json" }
        })
  });
  if (upstream.ok) {
    revalidateWorkspace();
  }
  if (upstream.status === 204) {
    return new Response(null, { status: 204 });
  }
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    },
    status: upstream.status
  });
}
