import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import collection from "@/data/collection.json";
import { collectionAddress } from "@/lib/contracts";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { goonImageUrl } from "@/lib/goon-images";

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
  const ownerWallets = Array.from(new Set((ownership ?? []).map((row) => row.owner_wallet_address)));
  const { data: profileWallets } = ownerWallets.length
    ? await supabase.from("profile_wallets").select("wallet_address,profile_id").in("wallet_address", ownerWallets)
    : { data: [] };
  const profileIds = Array.from(new Set((profileWallets ?? []).map((row) => row.profile_id)));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id,display_name,username").in("id", profileIds)
    : { data: [] };
  const profileNameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username]));
  const ownerNameByWallet = new Map((profileWallets ?? []).map((row) => [row.wallet_address, profileNameById.get(row.profile_id) ?? "Goon Holder"]));
  const byId = new Map<number, Record<string, unknown>>(
    collection.tokens.map((token) => [token.token_id, {
      name: token.name,
      discipline: token.discipline,
      rarity: token.rarity,
      imageUrl: goonImageUrl(token.token_id),
      matches_played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      current_streak: 0,
      rating: 1500,
      discipline_rank: null,
    }]),
  );
  for (const row of records ?? []) byId.set(row.token_id, { ...row });
  for (const row of ownership ?? []) byId.set(row.token_id, {
    ...byId.get(row.token_id),
    owner: row.owner_wallet_address,
    ownerName: ownerNameByWallet.get(row.owner_wallet_address) ?? "Goon Holder",
    ownershipVerifiedAt: row.verified_at,
  });
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
