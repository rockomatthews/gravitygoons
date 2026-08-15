import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { rescheduleMatch } from "@/lib/reschedule";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Match storage is not configured.");
    const { data: challenge } = await supabase.from("game_challenges").select("match_id").eq("id", id).maybeSingle();
    if (!challenge?.match_id) throw new Error("This challenge does not have a scheduled match.");
    return NextResponse.json(await rescheduleMatch(wallet, challenge.match_id, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reschedule match.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
