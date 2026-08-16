import { getWebEnv } from "../../../../src/config/env";
import { revalidateWorkspace } from "../../../../src/lib/revalidate";

export async function DELETE(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> }
): Promise<Response> {
  const { id } = await params;
  const url = new URL(
    `/api/v1/work-packages/${encodeURIComponent(id)}`,
    getWebEnv().NEXT_PUBLIC_API_URL
  );
  const upstream = await fetch(url, { method: "DELETE" });
  if (upstream.status === 204) {
    revalidateWorkspace();
    return new Response(null, { status: 204 });
  }
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json"
    },
    status: upstream.status
  });
}
