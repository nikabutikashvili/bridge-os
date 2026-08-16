import { globalSearchQuerySchema } from "@bridge-os/contracts";

import { getWebEnv } from "../../../src/config/env";

export async function GET(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const query = globalSearchQuerySchema.parse(
    Object.fromEntries(requestUrl.searchParams.entries())
  );
  const upstreamUrl = new URL(
    "/api/v1/search",
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  upstreamUrl.searchParams.set("q", query.q);
  upstreamUrl.searchParams.set("limit", String(query.limit));

  const upstream = await fetch(upstreamUrl, { cache: "no-store" });
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    },
    status: upstream.status
  });
}
