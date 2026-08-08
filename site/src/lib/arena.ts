import "server-only";

import collection from "@/data/collection.json";
import { goonImageUrl } from "@/lib/goon-images";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { addMovePresentations } from "@/lib/match-move-media";
import { getMatchWager } from "@/lib/match-escrow";

const DISCIPLINES = ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"];
const TERMINAL = new Set(["completed", "cancelled", "expired", "voided", "disputed"]);

type MatchRow = {
  id: string; status: string; discipline: number; match_word: string; match_mode?: string;
  first_token_id: number; second_token_id: number; winner_token_id: number | null;
  state: Record<string, unknown>; action_deadline: string | null; scheduled_start_at?: string | null;
  check_in_opens_at?: string | null; betting_closes_at?: string | null; first_checked_in_at?: string | null;
  second_checked_in_at?: string | null; first_action_at?: string | null; public_sequence?: number;
  ruleset_hash?: string; result_hash?: string | null; started_at: string | null; completed_at: string | null;
  created_at: string; first_wallet_address: string; second_wallet_address: string;
};

export type ArenaMatch = {
  id: string;
  status: "upcoming" | "live" | "active" | "completed" | "voided" | "cancelled" | "disputed";
  rawStatus: string;
  mode: "live_ranked";
  discipline: string;
  matchWord: string;
  scheduledStartAt: string | null;
  checkInOpensAt: string | null;
  bettingClosesAt: string | null;
  actionDeadline: string | null;
  startedAt: string | null;
  completedAt: string | null;
  publicSequence: number;
  rulesetHash: string;
  resultHash: string | null;
  winnerTokenId: number | null;
  firstCheckedIn: boolean;
  secondCheckedIn: boolean;
  athletes: [ArenaAthlete, ArenaAthlete];
  score: { firstLosses: number; secondLosses: number; setterTokenId: number | null; grit: Record<string, number>; pendingTrickId: number | null };
};

export type ArenaAthlete = {
  tokenId: number; name: string; discipline: string; rarity: string; species: string; image: string;
  ownerName: string; matchesPlayed: number; wins: number; losses: number; draws: number; rating: number; rank: number | null;
};

function displayStatus(row: MatchRow): ArenaMatch["status"] {
  if (row.status === "completed") return "completed";
  if (row.status === "voided" || row.status === "expired") return "voided";
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "disputed") return "disputed";
  return row.status === "matched" ? "live" : "upcoming";
}

async function ownerNames(wallets: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseAdmin();
  const names = new Map<string, string>();
  if (!supabase || !wallets.length) return names;
  const normalized = Array.from(new Set(wallets.map((wallet) => wallet.toLowerCase())));
  const { data: links } = await supabase.from("profile_wallets").select("wallet_address,profile_id").in("wallet_address", normalized);
  const profileIds = Array.from(new Set((links ?? []).map((link) => link.profile_id)));
  if (!profileIds.length) return names;
  const { data: profiles } = await supabase.from("profiles").select("id,display_name,username").in("id", profileIds);
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.username]));
  for (const link of links ?? []) names.set(link.wallet_address, byId.get(link.profile_id) ?? "Goon Holder");
  return names;
}

async function records(tokenIds: number[]): Promise<Map<number, Record<string, number | null>>> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !tokenIds.length) return new Map();
  const { data } = await supabase.from("discipline_ranks").select("token_id,matches_played,wins,losses,draws,rating,discipline_rank").in("token_id", Array.from(new Set(tokenIds)));
  return new Map((data ?? []).map((row) => [row.token_id, row]));
}

function athlete(tokenId: number, wallet: string, names: Map<string, string>, battle: Map<number, Record<string, number | null>>): ArenaAthlete {
  const token = collection.tokens[tokenId - 1];
  const record = battle.get(tokenId) ?? {};
  return {
    tokenId, name: token.name, discipline: token.discipline, rarity: token.rarity, species: token.species,
    image: goonImageUrl(tokenId),
    ownerName: names.get(wallet.toLowerCase()) ?? "Goon Holder",
    matchesPlayed: Number(record.matches_played ?? 0), wins: Number(record.wins ?? 0), losses: Number(record.losses ?? 0), draws: Number(record.draws ?? 0),
    rating: Number(record.rating ?? 1500), rank: record.discipline_rank == null ? null : Number(record.discipline_rank),
  };
}

function sanitize(row: MatchRow, names: Map<string, string>, battle: Map<number, Record<string, number | null>>): ArenaMatch {
  const state = row.state ?? {};
  const pending = state.pendingCall as { trickId?: number } | undefined;
  return {
    id: row.id, status: displayStatus(row), rawStatus: row.status, mode: "live_ranked",
    discipline: DISCIPLINES[row.discipline] ?? "Unknown", matchWord: row.match_word,
    scheduledStartAt: row.scheduled_start_at ?? null, checkInOpensAt: row.check_in_opens_at ?? null,
    bettingClosesAt: row.betting_closes_at ?? null, actionDeadline: row.action_deadline,
    startedAt: row.started_at, completedAt: row.completed_at, publicSequence: Number(row.public_sequence ?? 0),
    rulesetHash: row.ruleset_hash ?? `0x${"0".repeat(64)}`, resultHash: row.result_hash ?? null, winnerTokenId: row.winner_token_id,
    firstCheckedIn: Boolean(row.first_checked_in_at), secondCheckedIn: Boolean(row.second_checked_in_at),
    athletes: [athlete(row.first_token_id, row.first_wallet_address, names, battle), athlete(row.second_token_id, row.second_wallet_address, names, battle)],
    score: {
      firstLosses: Number(state.firstLosses ?? 0), secondLosses: Number(state.secondLosses ?? 0),
      setterTokenId: state.setterTokenId ? Number(state.setterTokenId) : null,
      grit: (state.grit ?? {}) as Record<string, number>, pendingTrickId: pending?.trickId ?? null,
    },
  };
}

const MATCH_SELECT = "id,status,discipline,match_word,match_mode,first_token_id,second_token_id,first_wallet_address,second_wallet_address,winner_token_id,state,action_deadline,scheduled_start_at,check_in_opens_at,betting_closes_at,first_checked_in_at,second_checked_in_at,first_action_at,public_sequence,ruleset_hash,result_hash,started_at,completed_at,created_at";

export async function listArenaMatches(input: { status?: string; discipline?: string; cursor?: string; limit?: number } = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { matches: [] as ArenaMatch[], nextCursor: null };
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 60);
  let query = supabase.from("pvp_matches").select(MATCH_SELECT).eq("match_mode", "live_ranked").order("created_at", { ascending: false }).limit(limit + 1);
  if (input.cursor) query = query.lt("created_at", input.cursor);
  if (input.status === "live") query = query.eq("match_mode", "live_ranked").eq("status", "matched");
  if (input.status === "upcoming") query = query.eq("match_mode", "live_ranked").eq("status", "queued");
  if (input.status === "results") query = query.in("status", Array.from(TERMINAL));
  if (input.discipline && input.discipline !== "All") {
    const index = DISCIPLINES.indexOf(input.discipline);
    if (index >= 0) query = query.eq("discipline", index);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as MatchRow[];
  const page = rows.slice(0, limit);
  const [names, battle] = await Promise.all([
    ownerNames(page.flatMap((row) => [row.first_wallet_address, row.second_wallet_address])),
    records(page.flatMap((row) => [row.first_token_id, row.second_token_id])),
  ]);
  return { matches: page.map((row) => sanitize(row, names, battle)), nextCursor: rows.length > limit ? page.at(-1)?.created_at ?? null : null };
}

export async function getArenaMatch(matchId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.from("pvp_matches").select(MATCH_SELECT).eq("id", matchId).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as MatchRow;
  const [names, battle, events, actions, wager] = await Promise.all([
    ownerNames([row.first_wallet_address, row.second_wallet_address]), records([row.first_token_id, row.second_token_id]),
    supabase.from("arena_match_events").select("sequence,event_type,public_payload,created_at").eq("match_id", matchId).order("sequence"),
    supabase.from("pvp_match_actions").select("turn_number,action_type,result_payload,created_at").eq("match_id", matchId).order("turn_number"),
    getMatchWager(matchId),
  ]);
  const actionsWithPresentation = await addMovePresentations(supabase, actions.data ?? []);
  const transcript = actionsWithPresentation.map((action) => ({
    turn: action.turn_number, action: action.action_type, createdAt: action.created_at,
    result: action.result_payload, presentation: action.presentation,
  }));
  return {
    match: sanitize(row, names, battle), events: events.data ?? [], transcript,
    wager,
  };
}

export async function getArenaRankings(discipline?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  let query = supabase.from("discipline_ranks").select("token_id,discipline,matches_played,wins,losses,draws,current_streak,rating,discipline_rank").order("rating", { ascending: false }).limit(100);
  if (discipline && discipline !== "All") {
    const index = DISCIPLINES.indexOf(discipline);
    if (index >= 0) query = query.eq("discipline", index);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    tokenId: row.token_id, discipline: DISCIPLINES[row.discipline], matchesPlayed: row.matches_played, wins: row.wins, losses: row.losses,
    draws: row.draws, streak: row.current_streak, rating: Number(row.rating), rank: row.discipline_rank,
    name: collection.tokens[row.token_id - 1].name,
  }));
}
