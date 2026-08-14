import "server-only";

import collection from "@/data/collection.json";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { getGoonCareer } from "@/lib/gooniverse-server";
import { goonImageUrl } from "@/lib/goon-images";
import { listSeaportListings } from "@/lib/seaport-listings";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CHAIN_ID = 8453;

export function canonicalTokenId(value: string | number): number | null {
  const raw = String(value);
  if (!/^\d+$/.test(raw)) return null;
  const tokenId = Number(raw);
  return Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= 1000 ? tokenId : null;
}

async function chainOwnership(tokenId: number) {
  if (collectionAddress === ZERO_ADDRESS) return { minted: false, owner: null as string | null };
  try {
    const wordStart = BigInt(Math.floor((tokenId - 1) / 256) * 256 + 1);
    const word = await publicClient.readContract({
      address: collectionAddress,
      abi: collectionAbi,
      functionName: "availabilityWord",
      args: [wordStart],
    });
    const available = (word & (1n << BigInt((tokenId - 1) % 256))) !== 0n;
    if (available) return { minted: false, owner: null as string | null };
    const owner = await publicClient.readContract({
      address: collectionAddress,
      abi: collectionAbi,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });
    return { minted: true, owner: owner.toLowerCase() };
  } catch {
    return { minted: false, owner: null as string | null };
  }
}

export async function getAthleteProfile(tokenId: number) {
  const canonical = canonicalTokenId(tokenId);
  if (!canonical) return null;
  const token = collection.tokens[canonical - 1];
  const supabase = getSupabaseAdmin();
  const [career, ownership, listings] = await Promise.all([
    getGoonCareer(canonical),
    chainOwnership(canonical),
    listSeaportListings(canonical).catch(() => []),
  ]);

  const emptyRecord = { matches_played: 0, wins: 0, losses: 0, draws: 0, current_streak: 0, rating: 1500, discipline_rank: null as number | null };
  if (!supabase) {
    return {
      token,
      imageUrl: goonImageUrl(canonical),
      career,
      record: emptyRecord,
      ownership,
      ownerProfile: null,
      sponsorProgress: null,
      sponsors: [],
      matches: [],
      listing: listings[0] ?? null,
      activeLock: null,
      activeChallenge: null,
      moveMovies: {},
    };
  }

  const [recordResult, progressResult, sponsorsResult, matchesResult, lockResult, challengeResult, pairsResult] = await Promise.all([
    supabase.from("discipline_ranks").select("matches_played,wins,losses,draws,current_streak,rating,discipline_rank").eq("token_id", canonical).maybeSingle(),
    supabase.from("athlete_sponsor_progress").select("verified_ranked_wins,active_sponsor_id,unlocked_trick_bitmap,updated_at").eq("token_id", canonical).maybeSingle(),
    supabase.from("athlete_sponsors").select("sponsor_id,milestone_wins,accepted_at_wins,accepted_at").eq("token_id", canonical).order("accepted_at", { ascending: false }),
    supabase.from("pvp_matches").select("id,status,first_token_id,second_token_id,winner_token_id,loser_token_id,match_word,match_mode,completed_at,created_at,result_hash").or(`first_token_id.eq.${canonical},second_token_id.eq.${canonical}`).order("created_at", { ascending: false }).limit(20),
    supabase.from("pvp_token_locks").select("match_id,created_at").eq("token_id", canonical).maybeSingle(),
    supabase.from("game_challenges").select("id,status,challenger_token_id,challenged_token_id,proposed_start_at,expires_at").or(`challenger_token_id.eq.${canonical},challenged_token_id.eq.${canonical}`).in("status", ["pending", "accepted"]).limit(1).maybeSingle(),
    supabase.from("move_media_pairs").select("id,trick_id,status").eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).eq("token_id", canonical),
  ]);

  const pairRows = pairsResult.data ?? [];
  const pairIds = pairRows.map((row) => row.id);
  const assetsResult = pairIds.length
    ? await supabase.from("move_media_assets").select("pair_id,video_url,poster_url,published_at,status,owner_decision,moderation_status").in("pair_id", pairIds).eq("outcome", "land").eq("status", "approved").eq("owner_decision", "approved").eq("moderation_status", "passed").not("published_at", "is", null)
    : { data: [] };
  const pairById = new Map(pairRows.map((row) => [row.id, row]));
  const moveMovies = Object.fromEntries((assetsResult.data ?? []).flatMap((asset) => {
    const pair = pairById.get(asset.pair_id);
    return pair ? [[pair.trick_id, { videoUrl: asset.video_url, posterUrl: asset.poster_url }]] : [];
  }));

  let ownerProfile = null;
  if (ownership.owner) {
    const { data: walletLink } = await supabase.from("profile_wallets").select("profile_id").eq("wallet_address", ownership.owner).maybeSingle();
    if (walletLink?.profile_id) {
      const { data } = await supabase.from("profiles").select("username,display_name").eq("id", walletLink.profile_id).maybeSingle();
      ownerProfile = data ?? null;
    }
  }

  return {
    token,
    imageUrl: goonImageUrl(canonical),
    career,
    record: recordResult.data ?? emptyRecord,
    ownership,
    ownerProfile,
    sponsorProgress: progressResult.data,
    sponsors: sponsorsResult.data ?? [],
    matches: (matchesResult.data ?? []).map((match) => ({
      ...match,
      opponentTokenId: match.first_token_id === canonical ? match.second_token_id : match.first_token_id,
      outcome: match.status !== "completed" ? match.status : match.winner_token_id === canonical ? "win" : match.loser_token_id === canonical ? "loss" : "draw",
    })),
    listing: listings[0] ?? null,
    activeLock: lockResult.data,
    activeChallenge: challengeResult.data,
    moveMovies,
  };
}
