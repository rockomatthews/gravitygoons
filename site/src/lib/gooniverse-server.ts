import { createHash, randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { goonImageUrl } from "@/lib/goon-images";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTokenOwnership } from "@/lib/profile-data";
import { TRICK_CATALOG, type Athlete, type Discipline } from "@/lib/pvp";
import {
  GOONIVERSE_RULESET,
  TRICK_LINE_OBSTACLES,
  resolveTrickLineAttempt,
  trickLineBankRewards,
  type TrickLineMode,
  type TrickLineStance,
} from "@/lib/gooniverse";

const GUEST_GOONS: Record<Discipline, number> = {
  Skateboarding: 34,
  Snowboarding: 45,
  Surfing: 207,
  BMX: 854,
  Motocross: 499,
  Skiing: 877,
};

type SessionRow = {
  id: string;
  token_id: number | null;
  wallet_at_start: string | null;
  guest: boolean;
  discipline: Discipline;
  server_seed: string;
  access_key_hash: string | null;
  action_sequence: number;
  banked_score: number;
  unbanked_score: number;
  multiplier: number;
  landed_count: number;
  status: "active" | "banked" | "fallen" | "expired";
  action_deadline: string;
  reward_claimed: boolean;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validTokenId(tokenId: number): number {
  if (!Number.isInteger(tokenId) || tokenId < 1 || tokenId > 1000) throw new Error("INVALID_TOKEN_ID");
  return tokenId;
}

function athleteFor(tokenId: number): Athlete {
  const token = collection.tokens[validTokenId(tokenId) - 1];
  return {
    tokenId,
    name: token.name,
    discipline: token.discipline as Discipline,
    rarity: token.rarity as Athlete["rarity"],
    trickSpecialty: token.trick_specialty,
    stats: token.stats,
  };
}

function publicGoon(tokenId: number) {
  const token = collection.tokens[tokenId - 1];
  return {
    tokenId,
    name: token.name,
    discipline: token.discipline,
    rarity: token.rarity,
    imageUrl: goonImageUrl(tokenId),
    stats: token.stats,
    specialty: token.trick_specialty,
  };
}

function sanitizeSession(session: SessionRow) {
  return {
    id: session.id,
    tokenId: session.token_id,
    guest: session.guest,
    discipline: session.discipline,
    sequence: session.action_sequence,
    bankedScore: session.banked_score,
    unbankedScore: session.unbanked_score,
    multiplier: Number(session.multiplier),
    landedCount: session.landed_count,
    status: session.status,
    actionDeadline: session.action_deadline,
    ruleset: GOONIVERSE_RULESET,
  };
}

async function requireSession(id: string, accessKey: string): Promise<SessionRow> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  const { data, error } = await supabase.from("trick_line_sessions").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("TRICK_LINE_NOT_FOUND");
  const session = data as SessionRow;
  if (!accessKey || !session.access_key_hash || sha256(accessKey) !== session.access_key_hash) throw new Error("TRICK_LINE_ACCESS_DENIED");
  return session;
}

async function verifySessionOwner(session: SessionRow, wallet: string | null): Promise<void> {
  if (session.guest) return;
  if (!wallet || !session.token_id || wallet.toLowerCase() !== session.wallet_at_start?.toLowerCase()) throw new Error("AUTH_REQUIRED");
  if (!await verifyTokenOwnership(wallet, session.token_id)) throw new Error("LIVE_OWNERSHIP_CHANGED");
}

export async function getGooniverseOverview() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { season: null, generators: [], recipes: 30, databaseReady: false };
  const [{ data: season }, { data: generators }, { count: recipes }] = await Promise.all([
    supabase.from("goon_seasons").select("id,title,story,status,starts_at,ends_at").eq("id", "zero-g-blackout-s1").maybeSingle(),
    supabase.from("goon_community_objectives").select("id,title,discipline,target_amount,contributed_amount,completed_at").eq("season_id", "zero-g-blackout-s1").order("discipline"),
    supabase.from("goon_item_definitions").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  return { season, generators: generators ?? [], recipes: recipes ?? 0, databaseReady: true };
}

export async function getGoonCareer(tokenId: number) {
  validTokenId(tokenId);
  const supabase = getSupabaseAdmin();
  const empty = { tokenId, economy: { grit_balance: 0, grit_reserved: 0, lifetime_grit_earned: 0, xp: 0, level: 1 }, materials: [], inventory: [], loadout: null, trophies: [], activeExpedition: null };
  if (!supabase) return { ...empty, goon: publicGoon(tokenId) };
  const [economy, materials, inventory, loadout, trophies, expedition] = await Promise.all([
    supabase.from("goon_economies").select("grit_balance,grit_reserved,lifetime_grit_earned,xp,level").eq("token_id", tokenId).maybeSingle(),
    supabase.from("goon_material_balances").select("material_key,quantity").eq("token_id", tokenId),
    supabase.from("goon_inventory").select("id,durability,crafted_at,reserved_activity_type,reserved_activity_id,item_definition:item_definition_id(id,name,slot,tier,competitive_modifier,max_durability)").eq("token_id", tokenId),
    supabase.from("goon_loadouts").select("*").eq("token_id", tokenId).maybeSingle(),
    supabase.from("goon_trophies").select("trophy_key,title,season_id,metadata,earned_at").eq("token_id", tokenId).order("earned_at", { ascending: false }),
    supabase.from("goon_expeditions").select("id,location,risk,status,departed_at,resolves_at").eq("token_id", tokenId).in("status", ["active", "ready"]).maybeSingle(),
  ]);
  return {
    goon: publicGoon(tokenId),
    tokenId,
    economy: economy.data ?? empty.economy,
    materials: materials.data ?? [],
    inventory: inventory.data ?? [],
    loadout: loadout.data,
    trophies: trophies.data ?? [],
    activeExpedition: expedition.data,
  };
}

export async function startTrickLine(input: { wallet: string | null; tokenId?: number; discipline?: Discipline }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  const guest = !input.tokenId;
  const discipline = input.discipline && TRICK_LINE_OBSTACLES[input.discipline] ? input.discipline : "Skateboarding";
  const tokenId = guest ? GUEST_GOONS[discipline] : validTokenId(input.tokenId!);
  const athlete = athleteFor(tokenId);
  if (!guest) {
    if (!input.wallet) throw new Error("AUTH_REQUIRED");
    if (!await verifyTokenOwnership(input.wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
  }
  const seed = randomBytes(32).toString("hex");
  const accessKey = randomBytes(24).toString("base64url");
  const actionDeadline = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data, error } = await supabase.from("trick_line_sessions").insert({
    token_id: guest ? null : tokenId,
    wallet_at_start: guest ? null : input.wallet!.toLowerCase(),
    guest,
    discipline: athlete.discipline,
    seed_commitment: sha256(seed),
    server_seed: seed,
    access_key_hash: sha256(accessKey),
    action_deadline: actionDeadline,
    status: "active",
  }).select("*").single();
  if (error) throw error;
  return {
    session: sanitizeSession(data as SessionRow),
    accessKey,
    goon: publicGoon(tokenId),
    tricks: TRICK_CATALOG[athlete.discipline],
    obstacles: TRICK_LINE_OBSTACLES[athlete.discipline],
  };
}

export async function playTrickLineAction(wallet: string | null, sessionId: string, input: { accessKey?: string; expectedSequence?: number; trickId?: number; stance?: TrickLineStance; obstacle?: string; mode?: TrickLineMode; gritUsed?: number }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  const session = await requireSession(sessionId, input.accessKey ?? "");
  await verifySessionOwner(session, wallet);
  if (session.status !== "active") throw new Error("TRICK_LINE_COMPLETE");
  if (new Date(session.action_deadline).getTime() <= Date.now()) {
    await supabase.from("trick_line_sessions").update({ status: "expired", completed_at: new Date().toISOString() }).eq("id", session.id).eq("status", "active");
    throw new Error("TRICK_LINE_EXPIRED");
  }
  const expectedSequence = Number(input.expectedSequence);
  if (!Number.isInteger(expectedSequence) || expectedSequence !== session.action_sequence) throw new Error("STALE_ACTION_SEQUENCE");
  const tokenId = session.token_id ?? GUEST_GOONS[session.discipline];
  const athlete = athleteFor(tokenId);
  const trick = TRICK_CATALOG[session.discipline].find((candidate) => candidate.id === Number(input.trickId));
  if (!trick) throw new Error("INVALID_TRICK");
  const obstacle = String(input.obstacle ?? "");
  if (!TRICK_LINE_OBSTACLES[session.discipline].includes(obstacle)) throw new Error("INVALID_OBSTACLE");
  const stance = input.stance === "switch" ? "switch" : "regular";
  const mode = input.mode === "send" ? "send" : "standard";
  const gritUsed = session.guest ? 0 : Math.max(0, Math.min(3, Number(input.gritUsed ?? 0)));
  if (gritUsed && session.token_id) {
    const { error } = await supabase.rpc("apply_goon_economy_event", {
      p_token_id: session.token_id,
      p_idempotency_key: `trick-line:${session.id}:${expectedSequence}:grit`,
      p_event_type: "spend",
      p_grit_balance_delta: -gritUsed,
      p_source_type: "trick_line",
      p_source_id: session.id,
      p_actor_wallet: wallet,
    });
    if (error) throw new Error(error.message.includes("INSUFFICIENT_GRIT") ? "INSUFFICIENT_GRIT" : error.message);
  }
  const sequence = expectedSequence + 1;
  const result = resolveTrickLineAttempt({ athlete, trick, stance, obstacle, mode, gritUsed, seed: session.server_seed, sequence, currentMultiplier: Number(session.multiplier) });
  const nextStatus = result.landed ? "active" : "fallen";
  const transcript = { trick: trick.name, stance, obstacle, mode, positiveModifier: result.positiveModifier, outcome: result.landed ? "land" : "fall" };
  const { error: actionError } = await supabase.from("trick_line_actions").insert({
    session_id: session.id, sequence, trick_id: trick.id, stance, obstacle, call_mode: mode, grit_used: gritUsed,
    chance: result.chance, roll: result.roll, landed: result.landed, score_delta: result.scoreDelta, transcript,
  });
  if (actionError && actionError.code !== "23505") throw actionError;
  const { data, error: updateError } = await supabase.from("trick_line_sessions").update({
    action_sequence: sequence,
    unbanked_score: result.landed ? session.unbanked_score + result.scoreDelta : 0,
    multiplier: result.nextMultiplier,
    landed_count: session.landed_count + (result.landed ? 1 : 0),
    status: nextStatus,
    action_deadline: new Date(Date.now() + 5 * 60_000).toISOString(),
    completed_at: result.landed ? null : new Date().toISOString(),
  }).eq("id", session.id).eq("action_sequence", expectedSequence).select("*").single();
  if (updateError) throw new Error("CONCURRENT_TRICK_LINE_ACTION");
  return { session: sanitizeSession(data as SessionRow), attempt: { ...result, trick: trick.name, stance, obstacle, mode } };
}

export async function bankTrickLine(wallet: string | null, sessionId: string, input: { accessKey?: string; expectedSequence?: number }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  const session = await requireSession(sessionId, input.accessKey ?? "");
  await verifySessionOwner(session, wallet);
  const retryingReward = session.status === "banked" && !session.reward_claimed;
  if (session.status !== "active" && !retryingReward) throw new Error("TRICK_LINE_NOT_BANKABLE");
  if (Number(input.expectedSequence) !== session.action_sequence) throw new Error("STALE_ACTION_SEQUENCE");
  const score = retryingReward ? session.banked_score : session.banked_score + session.unbanked_score;
  const rewards = trickLineBankRewards(score);
  const { data, error } = retryingReward
    ? { data: session, error: null }
    : await supabase.from("trick_line_sessions").update({
      banked_score: score, unbanked_score: 0, status: "banked", completed_at: new Date().toISOString(), reward_claimed: false,
    }).eq("id", session.id).eq("status", "active").eq("action_sequence", session.action_sequence).select("*").single();
  if (error) throw new Error("TRICK_LINE_ALREADY_RESOLVED");
  if (!session.guest && session.token_id) {
    const base = { p_token_id: session.token_id, p_source_type: "trick_line", p_source_id: session.id, p_actor_wallet: wallet };
    const events = [];
    if (rewards.grit || rewards.xp) events.push(supabase.rpc("apply_goon_economy_event", { ...base, p_idempotency_key: `trick-line:${session.id}:bank`, p_event_type: "reward", p_grit_balance_delta: rewards.grit, p_xp_delta: rewards.xp }));
    if (rewards.materialQuantity) events.push(supabase.rpc("apply_goon_economy_event", { ...base, p_idempotency_key: `trick-line:${session.id}:material`, p_event_type: "reward", p_material_key: rewards.material, p_material_delta: rewards.materialQuantity }));
    const results = await Promise.all(events);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    await supabase.from("trick_line_sessions").update({ reward_claimed: true }).eq("id", session.id).eq("reward_claimed", false);
  }
  return { session: sanitizeSession(data as SessionRow), rewards: session.guest ? { grit: 0, xp: 0, material: null, materialQuantity: 0 } : rewards };
}
