import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifySeevioWebhookToken } from "@/lib/seevio-server";

type WebhookPayload = {
  id?: string;
  status?: "completed" | "failed";
  failed_reason?: string | null;
  data?: {
    results?: string[];
    failed_reason?: string;
    last_frame_url?: string | null;
  } | null;
};

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    if (!verifySeevioWebhookToken(url.searchParams.get("token"))) {
      return NextResponse.json({ error: "Invalid webhook token." }, { status: 401 });
    }
    const body = await request.json() as WebhookPayload;
    if (!body.id) return NextResponse.json({ error: "Missing Seevio task ID." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

    const { data: jobData } = await supabase.from("move_generation_jobs").select("id,asset_id,status").eq("provider", "seevio").eq("provider_job_id", body.id).maybeSingle();
    const job = jobData as { id: string; asset_id: string; status: string } | null;
    if (!job) return NextResponse.json({ ok: true, ignored: "unknown_task" });
    if (job.status === "succeeded" || job.status === "failed") return NextResponse.json({ ok: true, duplicate: true });

    const now = new Date().toISOString();
    const videoUrl = body.data?.results?.[0];
    if (body.status !== "completed" || !videoUrl) {
      const reason = body.failed_reason ?? body.data?.failed_reason ?? "Seevio generation failed.";
      await Promise.all([
        supabase.from("move_generation_jobs").update({ status: "failed", error_message: reason, response_payload: body, completed_at: now }).eq("id", job.id),
        supabase.from("move_media_assets").update({ status: "failed" }).eq("id", job.asset_id),
      ]);
      return NextResponse.json({ ok: true, status: "failed" });
    }

    await Promise.all([
      supabase.from("move_generation_jobs").update({ status: "succeeded", response_payload: body, completed_at: now }).eq("id", job.id),
      supabase.from("move_media_assets").update({ status: "owner_review", video_url: videoUrl, poster_url: body.data?.last_frame_url ?? null, moderation_status: "manual_review", generated_at: now }).eq("id", job.asset_id),
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
