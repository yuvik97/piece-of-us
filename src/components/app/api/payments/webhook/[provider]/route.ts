import { fail } from "@/lib/http";
import { handleWebhook } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  if (Number(req.headers.get("content-length") || 0) > 256 * 1024) return fail(413, "too_large");
  return handleWebhook((await params).provider, req.headers, await req.text());
}
