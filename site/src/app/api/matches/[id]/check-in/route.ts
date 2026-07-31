import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { verifyTokenOwnership } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet] = await Promise.all([context.params, requireSessionAddress()]);
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Match storage is not configured.");
    const { data: match, error: matchError } = await supabase.from("pvp_matches")
      .select("first_token_id,second_token_id,first_wallet_address,second_wallet_address")
      .eq("id", id).maybeSingle();
    if (matchError || !match) throw new Error("Match not found.");
    const normalized = wallet.toLowerCase();
    const tokenId = normalized === match.first_wallet_address
      ? match.first_token_id
      : normalized === match.second_wallet_address ? match.second_token_id : null;
    if (!tokenId) throw new Error("Only match players can check in.");
    if (!(await verifyTokenOwnership(wallet, tokenId))) throw new Error("Live NFT ownership changed; check-in is blocked.");
    const { data, error } = await supabase.rpc("check_in_scheduled_match", { p_match_id: id, p_actor_wallet: wallet });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check in.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
