import "server-only";

import { cache } from "react";
import collection from "@/data/collection.json";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { goonImageUrl } from "@/lib/goon-images";
import { TRICK_CATALOG, type Discipline } from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PROFILE_CACHE_MS = 15_000;
const CHAIN_TIMEOUT_MS = 1_200;
const DATABASE_TIMEOUT_MS = 1_800;

type RecordRow = {
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  current_streak: number;
  rating: number;
  discipline_rank: number | null;
};

type MatchRow = {
  id: string;
  status: string;
  first_token_id: number;
  second_token_id: number;
  winner_token_id: number | null;
  loser_token_id: number | null;
  match_word: string;
  match_mode: string | null;
  completed_at: string | null;
  created_at: string;
  result_hash: string | null;
};

type AthleteSnapshot = {
  economy: { grit_balance: number; grit_reserved: number; lifetime_grit_earned: number; xp: number; level: number };
  materials: unknown[];
  inventory: unknown[];
  loadout: unknown | null;
  trophies: unknown[];
  activeExpedition: unknown | null;
  mastery: unknown[];
  record: RecordRow | null;
  sponsorProgress: { verified_ranked_wins: number; active_sponsor_id: string | null; unlocked_trick_bitmap: string; updated_at: string } | null;
  sponsors: Array<{ sponsor_id: string; milestone_wins: number; accepted_at_wins: number; accepted_at: string }>;
  matches: MatchRow[];
  activeLock: unknown | null;
  activeChallenge: unknown | null;
  moveMovies: Record<string, { videoUrl: string; posterUrl: string | null }>;
  listing: { currency?: string; price_minor?: string | number } | null;
  ownerProfile: { username: string; display_name: string } | null;
};

type Ownership = { minted: boolean; owner: string | null };
type AthleteProfileResult = {
  token: (typeof collection.tokens)[number];
  imageUrl: string;
  career: ReturnType<typeof buildCareer>;
  record: RecordRow;
  ownership: Ownership;
  ownerProfile: AthleteSnapshot["ownerProfile"];
  sponsorProgress: AthleteSnapshot["sponsorProgress"];
  sponsors: AthleteSnapshot["sponsors"];
  matches: Array<MatchRow & { opponentTokenId: number; outcome: string }>;
  listing: AthleteSnapshot["listing"];
  activeLock: unknown | null;
  activeChallenge: unknown | null;
  moveMovies: AthleteSnapshot["moveMovies"];
  snapshot: AthleteSnapshot;
};

const profileCache = new Map<number, { expiresAt: number; profile: AthleteProfileResult }>();
const careerCache = new Map<number, { expiresAt: number; snapshot: AthleteSnapshot }>();

const EMPTY_RECORD: RecordRow = {
  matches_played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  current_streak: 0,
  rating: 1500,
  discipline_rank: null,
};

export function canonicalTokenId(value: string | number): number | null {
  const raw = String(value);
  if (!/^\d+$/.test(raw)) return null;
  const tokenId = Number(raw);
  return Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= 1000 ? tokenId : null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

async function readChainOwnership(tokenId: number): Promise<Ownership> {
  if (collectionAddress === ZERO_ADDRESS) return { minted: false, owner: null };
  const wordStart = BigInt(Math.floor((tokenId - 1) / 256) * 256 + 1);
  const word = await publicClient.readContract({
    address: collectionAddress,
    abi: collectionAbi,
    functionName: "availabilityWord",
    args: [wordStart],
  });
  const available = (word & (1n << BigInt((tokenId - 1) % 256))) !== 0n;
  if (available) return { minted: false, owner: null };
  const owner = await publicClient.readContract({
    address: collectionAddress,
    abi: collectionAbi,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });
  return { minted: true, owner: owner.toLowerCase() };
}

function emptySnapshot(): AthleteSnapshot {
  return {
    economy: { grit_balance: 0, grit_reserved: 0, lifetime_grit_earned: 0, xp: 0, level: 1 },
    materials: [], inventory: [], loadout: null, trophies: [], activeExpedition: null, mastery: [],
    record: null, sponsorProgress: null, sponsors: [], matches: [], activeLock: null,
    activeChallenge: null, moveMovies: {}, listing: null, ownerProfile: null,
  };
}

function bitmapUnlocked(bitmap: string | null | undefined, trickId: number): boolean {
  if (trickId < 4) return true;
  const bits = (bitmap ?? "").replace(/^B'/, "").replace(/'$/, "").padStart(64, "0");
  return bits[63 - trickId] === "1";
}

async function readSnapshot(tokenId: number, owner: string | null, fallback: AthleteSnapshot): Promise<AthleteSnapshot> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return fallback;
  const request = supabase.rpc("get_athlete_profile_snapshot", {
    p_token_id: tokenId,
    p_owner_wallet: owner,
    p_contract_address: collectionAddress === ZERO_ADDRESS ? null : collectionAddress.toLowerCase(),
  }).retry(false).abortSignal(AbortSignal.timeout(DATABASE_TIMEOUT_MS));
  const snapshot = await withTimeout(
    Promise.resolve(request).then((result) => result.error || !result.data ? null : result.data as AthleteSnapshot),
    DATABASE_TIMEOUT_MS + 100,
    null,
  );
  return snapshot ?? fallback;
}

function buildCareer(tokenId: number, snapshot: AthleteSnapshot) {
  const token = collection.tokens[tokenId - 1];
  const discipline = token.discipline as Discipline;
  const bitmap = snapshot.sponsorProgress?.unlocked_trick_bitmap;
  return {
    goon: { tokenId, name: token.name, discipline, rarity: token.rarity, imageUrl: goonImageUrl(tokenId), stats: token.stats, specialty: token.trick_specialty },
    tokenId,
    economy: snapshot.economy,
    materials: snapshot.materials,
    inventory: snapshot.inventory,
    loadout: snapshot.loadout,
    trophies: snapshot.trophies,
    activeExpedition: snapshot.activeExpedition,
    unlockedTricks: TRICK_CATALOG[discipline].filter((trick) => bitmapUnlocked(bitmap, trick.id)),
    lockedTricks: TRICK_CATALOG[discipline].filter((trick) => trick.id >= 4 && !bitmapUnlocked(bitmap, trick.id)),
    mastery: snapshot.mastery,
  };
}

async function loadAthleteProfile(tokenId: number): Promise<AthleteProfileResult | null> {
  const canonical = canonicalTokenId(tokenId);
  if (!canonical) return null;
  const cached = profileCache.get(canonical);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  const stale = cached?.profile;
  const ownership = await withTimeout(readChainOwnership(canonical), CHAIN_TIMEOUT_MS, stale?.ownership ?? { minted: false, owner: null });
  const snapshot = await readSnapshot(canonical, ownership.owner, stale?.snapshot ?? emptySnapshot());
  const token = collection.tokens[canonical - 1];
  const matches = snapshot.matches.map((match) => ({
    ...match,
    opponentTokenId: match.first_token_id === canonical ? match.second_token_id : match.first_token_id,
    outcome: match.status !== "completed" ? match.status : match.winner_token_id === canonical ? "win" : match.loser_token_id === canonical ? "loss" : "draw",
  }));
  const profile: AthleteProfileResult = {
    token,
    imageUrl: goonImageUrl(canonical),
    career: buildCareer(canonical, snapshot),
    record: snapshot.record ?? EMPTY_RECORD,
    ownership,
    ownerProfile: snapshot.ownerProfile,
    sponsorProgress: snapshot.sponsorProgress,
    sponsors: snapshot.sponsors,
    matches,
    listing: snapshot.listing,
    activeLock: snapshot.activeLock,
    activeChallenge: snapshot.activeChallenge,
    moveMovies: snapshot.moveMovies,
    snapshot,
  };
  profileCache.set(canonical, { expiresAt: Date.now() + PROFILE_CACHE_MS, profile });
  careerCache.set(canonical, { expiresAt: Date.now() + PROFILE_CACHE_MS, snapshot });
  return profile;
}

async function loadAthleteCareer(tokenId: number) {
  const canonical = canonicalTokenId(tokenId);
  if (!canonical) throw new Error("Invalid Goon token ID.");

  const profile = profileCache.get(canonical);
  if (profile && profile.expiresAt > Date.now()) return profile.profile.career;

  const cached = careerCache.get(canonical);
  if (cached && cached.expiresAt > Date.now()) return buildCareer(canonical, cached.snapshot);

  const snapshot = await readSnapshot(canonical, null, cached?.snapshot ?? emptySnapshot());
  careerCache.set(canonical, { expiresAt: Date.now() + PROFILE_CACHE_MS, snapshot });
  return buildCareer(canonical, snapshot);
}

// React cache deduplicates repeated reads in one server render. The short
// in-process cache supplies a last-known-good fallback across nearby requests.
export const getAthleteProfile = cache(loadAthleteProfile);
export const getAthleteCareer = cache(loadAthleteCareer);
