import collection from "@/data/collection.json";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { goonImageUrl } from "@/lib/goon-images";
import type { MovePairStatus, OutcomeStatus, ProfileGoon, ProfileMove, PublicProfile, StudioMove, StudioOutcome } from "@/lib/profile-types";
import { TRICK_CATALOG, type Discipline } from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const CHAIN_ID = 8453;
const DEMO_USERNAME = (process.env.DEMO_PROFILE_USERNAME ?? "founder").toLowerCase();
const DEMO_WALLET = "0x0000000000000000000000000000000000001337";
const DEMO_TOKEN_IDS = [34, 35, 36, 39];
const RESERVED_USERNAMES = new Set(["api", "character", "game", "manage", "moves", "profile", "collection", "admin", "about"]);
const DISCIPLINE_INDEX: Record<Discipline, number> = {
  Skateboarding: 0,
  Snowboarding: 1,
  Surfing: 2,
  BMX: 3,
  Motocross: 4,
  Skiing: 5,
};

type ProfileRow = { id: string; username: string; display_name: string; bio: string; avatar_url: string | null };
type WalletRow = { wallet_address: string };
type OwnershipRow = { token_id: number };
type PairRow = { id: string; token_id: number; trick_id: number; status: string; created_at?: string | null; updated_at?: string | null };
type AssetRow = {
  id: string;
  pair_id: string;
  outcome: "land" | "fall";
  version: number;
  status: string;
  video_url: string | null;
  poster_url: string | null;
  owner_decision: "pending" | "approved" | "rejected";
  created_at?: string | null;
  updated_at?: string | null;
};

function normalizeStatus(value: string | undefined): MovePairStatus {
  const allowed: MovePairStatus[] = ["quoted", "paid", "queued", "generating", "owner_review", "approved", "rejected", "rerolling", "failed", "refunding", "refunded", "unpublished"];
  return allowed.includes(value as MovePairStatus) ? value as MovePairStatus : "no_movie";
}

function normalizeOutcomeStatus(value: string | undefined): OutcomeStatus {
  const allowed: OutcomeStatus[] = ["queued", "generating", "owner_review", "approved", "rejected", "failed", "unpublished"];
  return allowed.includes(value as OutcomeStatus) ? value as OutcomeStatus : "missing";
}

function bitmapUnlocked(bitmap:string|undefined,trickId:number){if(trickId<4)return true;const bits=(bitmap??"").replace(/[^01]/g,"").padStart(64,"0").slice(-64);return bits[63-trickId]==="1";}
function buildMoves(discipline: Discipline, tokenId: number, pairs: PairRow[], assets: AssetRow[], includePrivate = false,bitmap?:string): ProfileMove[] {
  return TRICK_CATALOG[discipline].map((trick) => {
    const pair = pairs.find((candidate) => candidate.token_id === tokenId && candidate.trick_id === trick.id);
    const pairAssets = pair ? assets.filter((asset) => asset.pair_id === pair.id) : [];
    const land = pairAssets.filter((asset) => asset.outcome === "land").sort((a, b) => b.version - a.version)[0];
    const fall = pairAssets.filter((asset) => asset.outcome === "fall").sort((a, b) => b.version - a.version)[0];
    const publicLand = land?.status === "approved" && land.owner_decision === "approved";
    return {
      trickId: trick.id,
      name: trick.name,
      difficulty: trick.difficulty,
      unlocked: bitmapUnlocked(bitmap,trick.id),
      pairId: pair?.id ?? null,
      pairStatus: normalizeStatus(pair?.status),
      landStatus: normalizeOutcomeStatus(land?.status),
      fallStatus: normalizeOutcomeStatus(fall?.status),
      landVideoUrl: includePrivate || publicLand ? land?.video_url ?? null : null,
      landPosterUrl: includePrivate || publicLand ? land?.poster_url ?? null : null,
    };
  });
}

function buildGoon(tokenId: number, pairs: PairRow[] = [], assets: AssetRow[] = [], includePrivate = false,bitmap?:string): ProfileGoon {
  const token = collection.tokens[tokenId - 1];
  const discipline = token.discipline as Discipline;
  return {
    tokenId,
    name: token.name,
    species: token.species,
    discipline,
    rarity: token.rarity,
    playStyle: token.play_style,
    trickSpecialty: token.trick_specialty,
    imageUrl: goonImageUrl(tokenId),
    moves: buildMoves(discipline, tokenId, pairs, assets, includePrivate,bitmap),
  };
}

function demoPairs(): { pairs: PairRow[]; assets: AssetRow[] } {
  return {
    pairs: [
      { id: "demo-approved", token_id: 34, trick_id: 0, status: "approved" },
      { id: "demo-review", token_id: 34, trick_id: 1, status: "owner_review" },
    ],
    assets: [
      { id: "demo-land-approved", pair_id: "demo-approved", outcome: "land", version: 1, status: "approved", video_url: "/media/double-flatspin-land.mp4", poster_url: "/media/double-flatspin-land-poster.jpg", owner_decision: "approved" },
      { id: "demo-fall-approved", pair_id: "demo-approved", outcome: "fall", version: 1, status: "approved", video_url: "/media/double-flatspin-fall.mp4", poster_url: "/media/double-flatspin-fall-poster.jpg", owner_decision: "approved" },
      { id: "demo-land-review", pair_id: "demo-review", outcome: "land", version: 1, status: "owner_review", video_url: "/media/double-flatspin-land.mp4", poster_url: "/media/double-flatspin-land-poster.jpg", owner_decision: "pending" },
      { id: "demo-fall-review", pair_id: "demo-review", outcome: "fall", version: 1, status: "owner_review", video_url: "/media/double-flatspin-fall.mp4", poster_url: "/media/double-flatspin-fall-poster.jpg", owner_decision: "pending" },
    ],
  };
}

export function demoPublicProfile(username = DEMO_USERNAME): PublicProfile {
  const { pairs, assets } = demoPairs();
  return {
    id: "demo-profile",
    username,
    displayName: "Gravity Goons Founder",
    bio: "Building the first athlete-owned action-sports cinema league.",
    avatarUrl: null,
    wallets: [DEMO_WALLET],
    goons: DEMO_TOKEN_IDS.map((tokenId) => buildGoon(tokenId, pairs, assets)),
    isDemo: true,
  };
}

export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const normalized = username.toLowerCase();
  const supabase = getSupabaseAdmin();
  if (!supabase) return normalized === DEMO_USERNAME ? demoPublicProfile(normalized) : null;

  const { data: profileData } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("username", normalized).maybeSingle();
  const profile = profileData as ProfileRow | null;
  if (!profile) return null;
  const { data: walletData } = await supabase.from("profile_wallets").select("wallet_address").eq("profile_id", profile.id);
  const wallets = ((walletData ?? []) as WalletRow[]).map((row) => row.wallet_address);
  if (!wallets.length) return { id: profile.id, username: profile.username, displayName: profile.display_name, bio: profile.bio, avatarUrl: profile.avatar_url, wallets: [], goons: [], isDemo: false };

  const { data: ownershipData } = await supabase.from("nft_ownership").select("token_id").eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).in("owner_wallet_address", wallets);
  const tokenIds = ((ownershipData ?? []) as OwnershipRow[]).map((row) => row.token_id).sort((a, b) => a - b);
  let pairs: PairRow[] = [];
  let assets: AssetRow[] = [];
  const bitmaps=new Map<number,string>();
  if (tokenIds.length) {
    const {data:progress}=await supabase.from("athlete_sponsor_progress").select("token_id,unlocked_trick_bitmap").in("token_id",tokenIds);
    for(const row of progress??[])bitmaps.set(row.token_id,row.unlocked_trick_bitmap);
    const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status").eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).in("token_id", tokenIds);
    pairs = (pairData ?? []) as PairRow[];
    const pairIds = pairs.map((pair) => pair.id);
    if (pairIds.length) {
      const { data: assetData } = await supabase
        .from("move_media_assets")
        .select("id,pair_id,outcome,version,status,video_url,poster_url,owner_decision")
        .in("pair_id", pairIds)
        .eq("outcome", "land")
        .eq("status", "approved")
        .eq("moderation_status", "passed")
        .not("published_at", "is", null);
      assets = (assetData ?? []) as AssetRow[];
    }
  }
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    wallets,
    goons: tokenIds.map((tokenId) => buildGoon(tokenId, pairs, assets,false,bitmaps.get(tokenId))),
    isDemo: false,
  };
}

export async function getProfileForWallet(walletAddress: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const wallet = walletAddress.toLowerCase();
  const { data: linkData } = await supabase.from("profile_wallets").select("profile_id").eq("wallet_address", wallet).maybeSingle();
  const link = linkData as { profile_id: string } | null;
  if (!link) return null;
  const { data } = await supabase.from("profiles").select("id,username,display_name,bio,avatar_url").eq("id", link.profile_id).maybeSingle();
  return data as ProfileRow | null;
}

export function validateUsername(username: string): string {
  const normalized = username.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) throw new Error("Numeric URLs are reserved for Gravity Goons NFT profiles.");
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(normalized)) throw new Error("Username must be 3–24 lowercase letters, numbers, underscores, or hyphens.");
  if (RESERVED_USERNAMES.has(normalized)) throw new Error("That username is reserved.");
  return normalized;
}

export async function saveProfileForWallet(walletAddress: string, input: { username: string; displayName: string; bio?: string }): Promise<ProfileRow> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured. The founder profile remains available as a local preview.");
  const wallet = walletAddress.toLowerCase();
  const username = validateUsername(input.username);
  const displayName = input.displayName.trim();
  const bio = (input.bio ?? "").trim();
  if (!displayName || displayName.length > 48) throw new Error("Display name must be 1–48 characters.");
  if (bio.length > 280) throw new Error("Bio must be 280 characters or fewer.");

  const existing = await getProfileForWallet(wallet);
  if (existing) {
    const { data, error } = await supabase.from("profiles").update({ username, display_name: displayName, bio }).eq("id", existing.id).select("id,username,display_name,bio,avatar_url").single();
    if (error) throw new Error(error.code === "23505" ? "That username is already taken." : error.message);
    return data as ProfileRow;
  }

  const { data, error } = await supabase.from("profiles").insert({ username, display_name: displayName, bio }).select("id,username,display_name,bio,avatar_url").single();
  if (error) throw new Error(error.code === "23505" ? "That username is already taken." : error.message);
  const profile = data as ProfileRow;
  const { error: walletError } = await supabase.from("profile_wallets").insert({ wallet_address: wallet, profile_id: profile.id, is_primary: true });
  if (walletError) {
    await supabase.from("profiles").delete().eq("id", profile.id);
    throw new Error(walletError.message);
  }
  return profile;
}

export async function readWalletOwnership(walletAddress: string): Promise<number[]> {
  const wallet = walletAddress.toLowerCase();
  if (collectionAddress === ZERO_ADDRESS) return process.env.NODE_ENV === "production" ? [] : DEMO_TOKEN_IDS;

  // Only minted tokens can have an owner. Reading the four availability words first
  // avoids 1,000 reverting ownerOf calls and is much friendlier to public RPCs.
  const availabilityWords = await Promise.all(
    [1n, 257n, 513n, 769n].map((startTokenId) => publicClient.readContract({
      address: collectionAddress,
      abi: collectionAbi,
      functionName: "availabilityWord",
      args: [startTokenId],
    })),
  );
  const mintedTokenIds: number[] = [];
  availabilityWords.forEach((word, wordIndex) => {
    const startTokenId = wordIndex * 256 + 1;
    for (let bit = 0; bit < 256 && startTokenId + bit <= 1000; bit += 1) {
      if ((word & (1n << BigInt(bit))) === 0n) mintedTokenIds.push(startTokenId + bit);
    }
  });

  const owned: number[] = [];
  for (let start = 0; start < mintedTokenIds.length; start += 100) {
    const tokenIds = mintedTokenIds.slice(start, start + 100);
    const results = await publicClient.multicall({
      allowFailure: true,
      contracts: tokenIds.map((tokenId) => ({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf" as const, args: [BigInt(tokenId)] })),
    });
    const failed = results.filter((result) => result.status === "failure").length;
    if (failed) throw new Error(`Base RPC could not verify ${failed} minted token owner${failed === 1 ? "" : "s"}.`);
    results.forEach((result, index) => {
      if (result.status === "success" && String(result.result).toLowerCase() === wallet) owned.push(tokenIds[index]);
    });
  }
  return owned;
}

export async function syncWalletOwnership(walletAddress: string): Promise<number[]> {
  const wallet = walletAddress.toLowerCase();
  const supabase = getSupabaseAdmin();
  if (!supabase || collectionAddress === ZERO_ADDRESS) return process.env.NODE_ENV === "production" ? [] : DEMO_TOKEN_IDS;
  const owned = await readWalletOwnership(wallet);

  const { data: staleData } = await supabase.from("nft_ownership").select("token_id").eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).eq("owner_wallet_address", wallet);
  const staleIds = ((staleData ?? []) as OwnershipRow[]).map((row) => row.token_id).filter((tokenId) => !owned.includes(tokenId));
  if (staleIds.length) await supabase.from("nft_ownership").delete().eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).in("token_id", staleIds);
  if (owned.length) {
    await supabase.from("nft_ownership").upsert(owned.map((tokenId) => ({ chain_id: CHAIN_ID, contract_address: collectionAddress.toLowerCase(), token_id: tokenId, owner_wallet_address: wallet, source: "rpc", verified_at: new Date().toISOString() })), { onConflict: "chain_id,contract_address,token_id" });
  }
  return owned;
}

export async function verifyTokenOwnership(walletAddress: string, tokenId: number): Promise<boolean> {
  const wallet = walletAddress.toLowerCase();
  if (collectionAddress === ZERO_ADDRESS) return process.env.NODE_ENV !== "production" && DEMO_TOKEN_IDS.includes(tokenId);
  try {
    const owner = await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(tokenId)] });
    const matches = owner.toLowerCase() === wallet;
    const supabase = getSupabaseAdmin();
    if (matches && supabase) await supabase.from("nft_ownership").upsert({ chain_id: CHAIN_ID, contract_address: collectionAddress.toLowerCase(), token_id: tokenId, owner_wallet_address: wallet, source: "rpc", verified_at: new Date().toISOString() }, { onConflict: "chain_id,contract_address,token_id" });
    return matches;
  } catch {
    return false;
  }
}

export async function getStudioMoves(walletAddress: string, tokenId: number): Promise<{ goon: ProfileGoon; moves: StudioMove[]; demo: boolean }> {
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) throw new Error("Invalid token ID.");
  if (!(await verifyTokenOwnership(walletAddress, tokenId))) throw new Error("The connected wallet does not currently own this Goon.");
  const supabase = getSupabaseAdmin();
  const quote = formatUsdc(Number(process.env.MOVE_PAIR_PRICE_USDC_MINOR ?? 12000000));
  const includedRerolls = Math.max(0, Number(process.env.MOVE_INCLUDED_REROLLS_PER_OUTCOME ?? 1));
  if (!supabase || collectionAddress === ZERO_ADDRESS) {
    const { pairs, assets } = demoPairs();
    const goon = buildGoon(tokenId, pairs, assets, true);
    const outcomesByPair = (pairId: string | null): StudioOutcome[] => pairId ? assets.filter((asset) => asset.pair_id === pairId).map((asset) => ({ id: asset.id, outcome: asset.outcome, version: asset.version, status: normalizeOutcomeStatus(asset.status), videoUrl: asset.video_url, posterUrl: asset.poster_url, ownerDecision: asset.owner_decision, rerollsRemaining: Math.max(0, includedRerolls - (asset.version - 1)), createdAt: asset.created_at ?? null, updatedAt: asset.updated_at ?? null })) : [];
    return { goon, moves: goon.moves.map((move) => ({ ...move, outcomes: outcomesByPair(move.pairId), quotedPriceUsdc: quote, workflowStartedAt: null, workflowUpdatedAt: null })), demo: true };
  }

  const { data: pairData } = await supabase.from("move_media_pairs").select("id,token_id,trick_id,status,created_at,updated_at").eq("chain_id", CHAIN_ID).eq("contract_address", collectionAddress.toLowerCase()).eq("token_id", tokenId);
  const {data:progress}=await supabase.from("athlete_sponsor_progress").select("unlocked_trick_bitmap").eq("token_id",tokenId).maybeSingle();
  const pairs = (pairData ?? []) as PairRow[];
  const pairIds = pairs.map((pair) => pair.id);
  let assets: AssetRow[] = [];
  if (pairIds.length) {
    const { data } = await supabase.from("move_media_assets").select("id,pair_id,outcome,version,status,video_url,poster_url,owner_decision,created_at,updated_at").in("pair_id", pairIds);
    assets = (data ?? []) as AssetRow[];
  }
  const goon = buildGoon(tokenId, pairs, assets, true,progress?.unlocked_trick_bitmap);
  return {
    goon,
    moves: goon.moves.map((move) => {
      const pair = pairs.find((candidate) => candidate.id === move.pairId);
      const pairAssets = move.pairId ? assets.filter((asset) => asset.pair_id === move.pairId) : [];
      const assetDates = pairAssets.flatMap((asset) => [asset.created_at, asset.updated_at]).filter((value): value is string => Boolean(value));
      return {
        ...move,
        outcomes: pairAssets.map((asset) => ({ id: asset.id, outcome: asset.outcome, version: asset.version, status: normalizeOutcomeStatus(asset.status), videoUrl: asset.video_url, posterUrl: asset.poster_url, ownerDecision: asset.owner_decision, rerollsRemaining: Math.max(0, includedRerolls - (asset.version - 1)), createdAt: asset.created_at ?? null, updatedAt: asset.updated_at ?? null })),
        quotedPriceUsdc: quote,
        workflowStartedAt: pairAssets.map((asset) => asset.created_at).filter((value): value is string => Boolean(value)).sort()[0] ?? pair?.updated_at ?? pair?.created_at ?? null,
        workflowUpdatedAt: [...assetDates, pair?.updated_at].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
      };
    }),
    demo: false,
  };
}

export function tokenDisciplineIndex(tokenId: number): number {
  return DISCIPLINE_INDEX[collection.tokens[tokenId - 1].discipline as Discipline];
}

export function tokenMove(tokenId: number, trickId: number) {
  const token = collection.tokens[tokenId - 1];
  const discipline = token.discipline as Discipline;
  return { token, discipline, trick: TRICK_CATALOG[discipline].find((candidate) => candidate.id === trickId) ?? null };
}

export function formatUsdc(minorUnits: number): string {
  return `$${(minorUnits / 1_000_000).toFixed(2)} USDC`;
}
