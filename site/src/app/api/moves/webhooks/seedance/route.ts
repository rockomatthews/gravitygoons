import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyFalWebhook } from "@/lib/seedance-server";

type WebhookPayload = {
  request_id?: string;
  status?: "OK" | "ERROR";
  error?: string;
  payload?: { video?: { url?: string }; seed?: number } | null;
};

export async function POST(request: Request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  try {
    if (!(await verifyFalWebhook(request.headers, rawBody))) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    const body = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
    if (!body.request_id) return NextResponse.json({ error: "Missing request ID." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
    const { data: jobData } = await supabase.from("move_generation_jobs").select("id,asset_id,status").eq("provider_job_id", body.request_id).maybeSingle();
    const job = jobData as { id: string; asset_id: string; status: string } | null;
    if (!job) return NextResponse.json({ ok: true, ignored: "unknown_request" });
    if (job.status === "succeeded") return NextResponse.json({ ok: true, duplicate: true });
    const now = new Date().toISOString();
    if (body.status !== "OK" || !body.payload?.video?.url) {
      await Promise.all([
        supabase.from("move_generation_jobs").update({ status: "failed", error_message: body.error ?? "Seedance generation failed.", response_payload: body, completed_at: now }).eq("id", job.id),
        supabase.from("move_media_assets").update({ status: "failed" }).eq("id", job.asset_id),
      ]);
      return NextResponse.json({ ok: true, status: "failed" });
    }
    await Promise.all([
      supabase.from("move_generation_jobs").update({ status: "succeeded", response_payload: body, completed_at: now }).eq("id", job.id),
      supabase.from("move_media_assets").update({ status: "owner_review", video_url: body.payload.video.url, moderation_status: "passed", generated_at: now }).eq("id", job.asset_id),
    ]);
    const { data: assetData } = await supabase.from("move_media_assets").select("pair_id").eq("id", job.asset_id).single();
    const pairId = (assetData as { pair_id: string }).pair_id;
    const { data: outcomesData } = await supabase.from("move_media_assets").select("outcome,version,status").eq("pair_id", pairId).order("version", { ascending: false });
    const latest = new Map<string, string>();
    for (const asset of (outcomesData ?? []) as { outcome: string; status: string }[]) if (!latest.has(asset.outcome)) latest.set(asset.outcome, asset.status);
    await supabase.from("move_media_pairs").update({ status: latest.size === 2 && [...latest.values()].every((status) => status === "owner_review") ? "owner_review" : "generating" }).eq("id", pairId);
    return NextResponse.json({ ok: true, status: "owner_review" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 });
  }
}

