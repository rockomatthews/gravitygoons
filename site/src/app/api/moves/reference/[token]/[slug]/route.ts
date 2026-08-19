import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { MOVE_REFERENCE_BUCKET } from "@/lib/move-reference-server";
import { parseSingleByteRange, verifyMoveReferenceAccess } from "@/lib/move-reference-access";

type RouteContext = { params: Promise<{ token: string; slug: string }> };

function responseHeaders(length: number): Headers {
  return new Headers({
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "content-disposition": "inline",
    "content-length": String(length),
    "content-type": "video/mp4",
    "x-content-type-options": "nosniff",
  });
}

async function serveReference(request: Request, context: RouteContext, headOnly: boolean): Promise<Response> {
  const { token, slug } = await context.params;
  const objectPath = verifyMoveReferenceAccess(token, slug);
  if (!objectPath) return new Response("Not found.", { status: 404 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Unavailable.", { status: 503 });
  const { data, error } = await supabase.storage.from(MOVE_REFERENCE_BUCKET).download(objectPath);
  if (error || !data) {
    console.error("move_reference_download_failed", { objectPath, reason: error?.message ?? "No object returned." });
    return new Response("Not found.", { status: 404 });
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const range = parseSingleByteRange(request.headers.get("range"), bytes.byteLength);
  if (range === "invalid") {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${bytes.byteLength}` } });
  }
  if (range) {
    const body = bytes.slice(range.start, range.end + 1);
    const headers = responseHeaders(body.byteLength);
    headers.set("content-range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
    return new Response(headOnly ? null : body, { status: 206, headers });
  }
  return new Response(headOnly ? null : bytes, { status: 200, headers: responseHeaders(bytes.byteLength) });
}

export async function GET(request: Request, context: RouteContext) {
  return serveReference(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return serveReference(request, context, true);
}
