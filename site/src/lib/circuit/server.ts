import "server-only";

import { createHash, randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { goonImageUrl } from "@/lib/goon-images";
import { syncWalletOwnership, verifyTokenOwnership } from "@/lib/profile-data";
import { TRICK_CATALOG, type Athlete, type Discipline } from "@/lib/pvp";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { breadthMultiplier, circuitLevel, circuitLevelsFor } from "./content";
import { medalFor, resolveCircuitSector } from "./engine";
import type { CircuitMedal, CircuitRunState, CircuitSectorChoice } from "./types";

type RunRow = CircuitRunState & {
  token_id: number;
  level_id: string;
  wallet_at_start: string;
  server_seed: string;
  access_key_hash: string;
  transcript: Array<Record<string, unknown>>;
  action_deadline: string;
};

const RULESET = "blackout-circuit-v1";
const MEDAL_RANK: Record<CircuitMedal, number> = { none: 0, bronze: 1, silver: 2, gold: 3 };

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function validTokenId(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error("INVALID_TOKEN_ID");
  return value;
}
function athleteFor(tokenId: number): Athlete {
  const token = collection.tokens[validTokenId(tokenId) - 1];
  return { tokenId, name: token.name, discipline: token.discipline as Discipline, rarity: token.rarity as Athlete["rarity"], trickSpecialty: token.trick_specialty, stats: token.stats };
}
function publicState(row: RunRow) {
  return { id: row.id, tokenId: row.token_id, levelId: row.level_id, sequence: row.sequence, score: row.score, momentum: row.momentum, damage: row.damage, status: row.status, actionDeadline: row.action_deadline, ruleset: RULESET };
}
function unlocked(bitmap: string | null | undefined, trickId: number): boolean {
  if (trickId < 4) return true;
  const bits = (bitmap ?? "").replace(/^B'/, "").replace(/'$/, "").padStart(64, "0");
  return bits[63 - trickId] === "1";
}

export async function getCircuitOverview(wallet: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("CIRCUIT_DATABASE_UNAVAILABLE");
  const tokenIds = await syncWalletOwnership(wallet);
  const { data: records } = tokenIds.length ? await supabase.from("circuit_level_records").select("token_id,level_id,best_score,best_medal,completions").in("token_id", tokenIds) : { data: [] };
  const recordsByToken = new Map<number, typeof records>();
  for (const record of records ?? []) recordsByToken.set(record.token_id, [...(recordsByToken.get(record.token_id) ?? []), record]);
  const disciplines = new Set(tokenIds.map((id) => collection.tokens[id - 1].discipline));
  return {
    breadth: { uniqueDisciplines: disciplines.size, materialMultiplier: breadthMultiplier(disciplines.size) },
    goons: tokenIds.map((tokenId) => {
      const token = collection.tokens[tokenId - 1];
      return { tokenId, name: token.name, discipline: token.discipline, rarity: token.rarity, stats: token.stats, imageUrl: goonImageUrl(tokenId), levels: circuitLevelsFor(token.discipline as Discipline), records: recordsByToken.get(tokenId) ?? [] };
    }),
  };
}

export async function startCircuitRun(wallet: string, input: { tokenId?: number; levelId?: string }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("CIRCUIT_DATABASE_UNAVAILABLE");
  const tokenId = validTokenId(Number(input.tokenId));
  if (!await verifyTokenOwnership(wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
  const athlete = athleteFor(tokenId);
  const level = circuitLevel(String(input.levelId ?? ""));
  if (level.discipline !== athlete.discipline) throw new Error("WRONG_DISCIPLINE_FOR_LEVEL");
  if (level.number > 1) {
    const previousId = circuitLevelsFor(level.discipline)[level.number - 2].id;
    const { data: previous } = await supabase.from("circuit_level_records").select("completions").eq("token_id", tokenId).eq("level_id", previousId).maybeSingle();
    if (!previous?.completions) throw new Error("PREVIOUS_LEVEL_REQUIRED");
  }
  await supabase.from("circuit_runs").update({ status: "expired", completed_at: new Date().toISOString() }).eq("token_id", tokenId).eq("status", "active").lt("action_deadline", new Date().toISOString());
  const seed = randomBytes(32).toString("hex");
  const accessKey = randomBytes(24).toString("base64url");
  const deadline = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await supabase.from("circuit_runs").insert({ token_id: tokenId, wallet_at_start: wallet.toLowerCase(), level_id: level.id, discipline: athlete.discipline, server_seed: seed, seed_commitment: sha256(seed), access_key_hash: sha256(accessKey), action_deadline: deadline }).select("*").single();
  if (error) throw new Error(error.code === "23505" ? "GOON_ALREADY_RUNNING_CIRCUIT" : error.message);
  const { data: progress } = await supabase.from("athlete_sponsor_progress").select("unlocked_trick_bitmap").eq("token_id", tokenId).maybeSingle();
  return { run: publicState(data as RunRow), accessKey, level, goon: { tokenId, name: athlete.name, discipline: athlete.discipline, stats: athlete.stats, imageUrl: goonImageUrl(tokenId) }, tricks: TRICK_CATALOG[athlete.discipline].filter((trick) => unlocked(progress?.unlocked_trick_bitmap, trick.id)) };
}

export async function playCircuitSector(wallet: string, runId: string, input: CircuitSectorChoice & { accessKey?: string; expectedSequence?: number }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("CIRCUIT_DATABASE_UNAVAILABLE");
  const { data, error } = await supabase.from("circuit_runs").select("*").eq("id", runId).maybeSingle();
  if (error || !data) throw new Error("CIRCUIT_RUN_NOT_FOUND");
  const row = data as RunRow;
  if (row.wallet_at_start.toLowerCase() !== wallet.toLowerCase() || !await verifyTokenOwnership(wallet, row.token_id)) throw new Error("LIVE_OWNERSHIP_CHANGED");
  if (!input.accessKey || sha256(input.accessKey) !== row.access_key_hash) throw new Error("CIRCUIT_ACCESS_DENIED");
  if (row.status !== "active") throw new Error("CIRCUIT_RUN_COMPLETE");
  if (new Date(row.action_deadline).getTime() <= Date.now()) throw new Error("CIRCUIT_RUN_EXPIRED");
  if (Number(input.expectedSequence) !== row.sequence) throw new Error("STALE_ACTION_SEQUENCE");
  const athlete = athleteFor(row.token_id);
  const level = circuitLevel(row.level_id);
  const trick = TRICK_CATALOG[athlete.discipline].find((candidate) => candidate.id === Number(input.trickId));
  if (!trick) throw new Error("INVALID_TRICK");
  if (!(["clean", "push", "overdrive"] as const).includes(input.risk)) throw new Error("INVALID_CIRCUIT_RISK");
  if (!(["regular", "switch"] as const).includes(input.stance)) throw new Error("INVALID_CIRCUIT_STANCE");
  const { data: progress } = await supabase.from("athlete_sponsor_progress").select("unlocked_trick_bitmap").eq("token_id", row.token_id).maybeSingle();
  if (!unlocked(progress?.unlocked_trick_bitmap, trick.id)) throw new Error("TRICK_NOT_UNLOCKED");
  const resolved = resolveCircuitSector({ state: publicState(row) as CircuitRunState, level, athlete, trick, choice: input, seed: row.server_seed });
  const transcript = [...(row.transcript ?? []), { ...input, accessKey: undefined, trickName: trick.name, ...resolved.result }];
  const completedAt = resolved.state.status === "active" ? null : new Date().toISOString();
  const { data: updated, error: updateError } = await supabase.from("circuit_runs").update({ sequence: resolved.state.sequence, score: resolved.state.score, momentum: resolved.state.momentum, damage: resolved.state.damage, status: resolved.state.status, transcript, action_deadline: new Date(Date.now() + 15 * 60_000).toISOString(), completed_at: completedAt, updated_at: new Date().toISOString() }).eq("id", runId).eq("status", "active").eq("sequence", row.sequence).select("*").single();
  if (updateError) throw new Error("CONCURRENT_CIRCUIT_ACTION");
  let reward: null | { firstClear: boolean; materials: number; multiplier: number; xp: number } = null;
  if (resolved.state.status !== "active") reward = await settleRun(supabase, wallet, athlete, level, resolved.state);
  return { run: publicState(updated as RunRow), result: resolved.result, reward, seedReveal: completedAt ? row.server_seed : null };
}

async function settleRun(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, wallet: string, athlete: Athlete, level: ReturnType<typeof circuitLevel>, state: CircuitRunState) {
  const medal = medalFor(state.score, level);
  const { data: prior } = await supabase.from("circuit_level_records").select("best_score,best_medal,completions,first_clear_claimed").eq("token_id", athlete.tokenId).eq("level_id", level.id).maybeSingle();
  const completed = state.status === "complete";
  const firstClear = completed && !prior?.first_clear_claimed;
  const bestMedal = MEDAL_RANK[medal] > MEDAL_RANK[(prior?.best_medal as CircuitMedal) ?? "none"] ? medal : (prior?.best_medal ?? "none");
  await supabase.from("circuit_level_records").upsert({ token_id: athlete.tokenId, level_id: level.id, best_score: Math.max(state.score, Number(prior?.best_score ?? 0)), best_medal: bestMedal, completions: Number(prior?.completions ?? 0) + (completed ? 1 : 0), first_clear_claimed: Boolean(prior?.first_clear_claimed) || firstClear, updated_at: new Date().toISOString() });
  const owned = await syncWalletOwnership(wallet);
  const unique = new Set(owned.map((id) => collection.tokens[id - 1].discipline)).size;
  const multiplier = breadthMultiplier(unique);
  const materials = firstClear ? Math.max(1, Math.round((2 + level.number) * multiplier)) : 0;
  const xp = completed ? 20 + level.number * 10 : 0;
  if (firstClear || xp) await supabase.rpc("apply_goon_economy_event", { p_token_id: athlete.tokenId, p_idempotency_key: `circuit:${state.id}:settle`, p_event_type: "circuit_clear", p_grit_balance_delta: 0, p_grit_reserved_delta: 0, p_xp_delta: xp, p_material_key: firstClear ? "components" : null, p_material_delta: materials, p_source_type: "blackout_circuit", p_source_id: state.id, p_actor_wallet: wallet.toLowerCase(), p_metadata: { levelId: level.id, medal, score: state.score, breadthMultiplier: multiplier } });
  const { data: records } = await supabase.from("circuit_level_records").select("best_medal,completions,best_score").eq("token_id", athlete.tokenId);
  const completedRecords = (records ?? []).filter((record) => Number(record.completions) > 0);
  await supabase.from("circuit_licenses").upsert({ token_id: athlete.tokenId, completed_levels: completedRecords.length, bronze_medals: completedRecords.filter((record) => record.best_medal === "bronze").length, silver_medals: completedRecords.filter((record) => record.best_medal === "silver").length, gold_medals: completedRecords.filter((record) => record.best_medal === "gold").length, circuit_xp: completedRecords.reduce((sum, record) => sum + Math.floor(Number(record.best_score) / 50), 0), updated_at: new Date().toISOString() });
  if (completed && medal === "gold") await supabase.from("goon_trophies").upsert({ token_id: athlete.tokenId, trophy_key: `circuit-gold-${level.id}`, title: `${level.name} Gold`, season_id: "zero-g-blackout-s1", metadata: { levelId: level.id, discipline: level.discipline, score: state.score } }, { onConflict: "token_id,trophy_key", ignoreDuplicates: true });
  if (completed && level.number === 5) await supabase.from("goon_trophies").upsert({ token_id: athlete.tokenId, trophy_key: `circuit-generator-${level.discipline.toLowerCase()}`, title: `${level.discipline} Generator Champion`, season_id: "zero-g-blackout-s1", metadata: { levelId: level.id, discipline: level.discipline, score: state.score } }, { onConflict: "token_id,trophy_key", ignoreDuplicates: true });
  return { firstClear, materials, multiplier, xp };
}
