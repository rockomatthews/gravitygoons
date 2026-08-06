import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { verifyTokenOwnership } from "@/lib/profile-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function normalizeExpectedWallet(value: unknown) {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
}

async function playerCheckInState(id: string, wallet: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  const { data: match, error } = await supabase.from("pvp_matches")
    .select("first_token_id,second_token_id,first_wallet_address,second_wallet_address,first_checked_in_at,second_checked_in_at")
    .eq("id", id).maybeSingle();
  if (error || !match) throw new Error("Match not found.");
  const normalized = wallet.toLowerCase();
  if (normalized === match.first_wallet_address.toLowerCase()) {
    return { viewerTokenId: match.first_token_id, viewerCheckedIn: Boolean(match.first_checked_in_at) };
  }
  if (normalized === match.second_wallet_address.toLowerCase()) {
    return { viewerTokenId: match.second_token_id, viewerCheckedIn: Boolean(match.second_checked_in_at) };
  }
  throw new Error("Only match players can check in.");
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to check in.";
  const unauthorized = message === "AUTH_REQUIRED" || message === "WALLET_SESSION_MISMATCH";
  return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 400 });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet] = await Promise.all([context.params, requireSessionAddress()]);
    const expectedWallet = normalizeExpectedWallet(request.headers.get("x-gravity-wallet"));
    if (!expectedWallet || expectedWallet !== wallet.toLowerCase()) throw new Error("WALLET_SESSION_MISMATCH");
    return NextResponse.json(await playerCheckInState(id, wallet));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([
      context.params,
      requireSessionAddress(),
      request.json().catch(() => ({})) as Promise<{ expectedWallet?: unknown }>,
    ]);
    const expectedWallet = normalizeExpectedWallet(body.expectedWallet);
    if (!expectedWallet || expectedWallet !== wallet.toLowerCase()) throw new Error("WALLET_SESSION_MISMATCH");
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error("Match storage is not configured.");
    const { data: match, error: matchError } = await supabase.from("pvp_matches")
      .select("first_token_id,second_token_id,first_wallet_address,second_wallet_address")
      .eq("id", id).maybeSingle();
    if (matchError || !match) throw new Error("Match not found.");
    const normalized = wallet.toLowerCase();
    const tokenId = normalized === match.first_wallet_address.toLowerCase()
      ? match.first_token_id
      : normalized === match.second_wallet_address.toLowerCase() ? match.second_token_id : null;
    if (!tokenId) throw new Error("Only match players can check in.");
    if (!(await verifyTokenOwnership(wallet, tokenId))) throw new Error("Live NFT ownership changed; check-in is blocked.");
    const { data, error } = await supabase.rpc("check_in_scheduled_match", { p_match_id: id, p_actor_wallet: wallet });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ...data, ...(await playerCheckInState(id, wallet)) });
  } catch (error) {
    return failure(error);
  }
}
