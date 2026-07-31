import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { collectionAddress } from "@/lib/contracts";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const wallet = readSessionAddress((await cookies()).get(SESSION_COOKIE)?.value);
  if (!supabase) return NextResponse.json({ wallet, athletes: [], generatedAt: new Date().toISOString() });
  const [{ data: records }, { data: ownership }, { data: locks }, { data: challenges }] = await Promise.all([
    supabase.from("discipline_ranks").select("token_id,matches_played,wins,losses,draws,current_streak,rating,discipline_rank"),
    supabase.from("nft_ownership").select("token_id,owner_wallet_address,verified_at").eq("chain_id", 8453).eq("contract_address", collectionAddress.toLowerCase()),
    supabase.from("pvp_token_locks").select("token_id,match_id"),
    supabase.from("game_challenges").select("id,challenger_token_id,challenged_token_id,status").in("status", ["incoming", "accepted", "active"]),
  ]);
  const byId = new Map<number, Record<string, unknown>>();
  for (const row of records ?? []) byId.set(row.token_id, { ...row });
  for (const row of ownership ?? []) byId.set(row.token_id, { ...byId.get(row.token_id), owner: row.owner_wallet_address, ownershipVerifiedAt: row.verified_at });
  for (const row of locks ?? []) byId.set(row.token_id, { ...byId.get(row.token_id), matchId: row.match_id });
  for (const row of challenges ?? []) {
    for (const tokenId of [row.challenger_token_id, row.challenged_token_id]) {
      byId.set(tokenId, { ...byId.get(tokenId), challengeId: row.id, challengeStatus: row.status });
    }
  }
  return NextResponse.json({
    wallet,
    athletes: [...byId].map(([tokenId, value]) => ({ tokenId, ...value })),
    generatedAt: new Date().toISOString(),
  });
}
