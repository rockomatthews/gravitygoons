import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function totals(matchId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data } = await supabase.from("spectator_predictions").select("predicted_token_id,amount").eq("match_id", matchId).eq("stake_type", "play_points");
  const grouped = new Map<number, number>();
  for (const row of data ?? []) grouped.set(row.predicted_token_id, (grouped.get(row.predicted_token_id) ?? 0) + Number(row.amount));
  return Array.from(grouped, ([tokenId, points]) => ({ tokenId, points }));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ predictions: await totals(id), currency: "PLAY", cashValue: 0 });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json() as Promise<{ tokenId?: number }>]);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Prediction storage is not configured.");
    const { data: match } = await supabase.from("pvp_matches").select("status,first_token_id,second_token_id,scheduled_start_at,first_action_at,started_at").eq("id", id).maybeSingle();
    if (!match) throw new Error("Match not found.");
    if (![match.first_token_id, match.second_token_id].includes(Number(body.tokenId))) throw new Error("Choose one of the two Goons in this match.");
    const closeAt = match.scheduled_start_at ?? match.started_at;
    if (match.first_action_at || (closeAt && Date.now() >= Date.parse(closeAt)) || ["completed", "voided", "cancelled", "disputed"].includes(match.status)) {
      throw new Error("Predictions are locked for this match.");
    }
    const { error } = await supabase.from("spectator_predictions").upsert({
      match_id: id, wallet_address: wallet.toLowerCase(), predicted_token_id: Number(body.tokenId), stake_type: "play_points", amount: 1,
    }, { onConflict: "match_id,wallet_address" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, predictions: await totals(id), currency: "PLAY", cashValue: 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save prediction.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
