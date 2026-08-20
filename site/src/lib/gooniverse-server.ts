import { createHash, randomBytes } from "node:crypto";
import collection from "@/data/collection.json";
import { getAthleteCareer } from "@/lib/athlete-profile";
import { goonImageUrl } from "@/lib/goon-images";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncWalletOwnership, verifyTokenOwnership } from "@/lib/profile-data";
import { TRICK_CATALOG, type Athlete, type Discipline } from "@/lib/pvp";
import {
  GOONIVERSE_RULESET,
  deterministicRoll,
  masteryAttemptUnlocks,
  masteryEntryCost,
  masteryGuaranteeRun,
  masteryUnlockChance,
  TRICK_LINE_OBSTACLES,
  resolveTrickLineAttempt,
  trickLineBankRewards,
  type TrickLineMode,
  type TrickLineStance,
} from "@/lib/gooniverse";

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
  target_trick_id: number | null;
  entry_cost: number;
  mastery_chance: number | null;
  mastery_qualified: boolean;
  mastery_unlocked: boolean;
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
    targetTrickId: session.target_trick_id,
    entryCost: session.entry_cost,
    masteryChance: session.mastery_chance,
    masteryQualified: session.mastery_qualified,
    masteryUnlocked: session.mastery_unlocked,
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
  if (!wallet || !session.token_id || wallet.toLowerCase() !== session.wallet_at_start?.toLowerCase()) throw new Error("AUTH_REQUIRED");
  if (!await verifyTokenOwnership(wallet, session.token_id)) throw new Error("LIVE_OWNERSHIP_CHANGED");
}

function bitmapUnlocked(bitmap: string | null | undefined, trickId: number): boolean {
  if (trickId < 4) return true;
  const bits = (bitmap ?? "").replace(/^B'/, "").replace(/'$/, "").padStart(64, "0");
  return bits[63 - trickId] === "1";
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

export async function getTrophyHall(){const supabase=getSupabaseAdmin();if(!supabase)return{recent:[],counts:[],total:0};const{data,error}=await supabase.from("goon_trophies").select("id,token_id,trophy_key,title,season_id,earned_at,season:season_id(title)").order("earned_at",{ascending:false}).limit(60);if(error)throw error;const rows=data??[],countMap=new Map<string,number>();for(const row of rows)countMap.set(row.title,(countMap.get(row.title)??0)+1);return{total:rows.length,counts:[...countMap.entries()].map(([title,count])=>({title,count})).slice(0,6),recent:rows.map(row=>({id:row.id,tokenId:row.token_id,title:row.title,earnedAt:row.earned_at,seasonTitle:(row.season as unknown as {title?:string}|null)?.title??null,goonName:collection.tokens[row.token_id-1]?.name??`Goon #${row.token_id}`,imageUrl:goonImageUrl(row.token_id)}))};}

export async function contributeBattery(wallet:string,input:{tokenId?:number;inventoryId?:string}){const tokenId=validTokenId(Number(input.tokenId));if(!input.inventoryId)throw new Error("BATTERY_REQUIRED");if(!await verifyTokenOwnership(wallet,tokenId))throw new Error("LIVE_OWNERSHIP_REQUIRED");const discipline=collection.tokens[tokenId-1].discipline as Discipline;const supabase=getSupabaseAdmin();if(!supabase)throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");const{data,error}=await supabase.rpc("contribute_zero_g_battery",{p_token_id:tokenId,p_wallet:wallet.toLowerCase(),p_inventory_id:input.inventoryId,p_discipline:discipline});if(error)throw new Error(error.message);return data;}

export async function getGoonCareer(tokenId: number) {
  validTokenId(tokenId);
  return getAthleteCareer(tokenId);
}

export async function getWalletCareerSummary(wallet:string){
  const supabase=getSupabaseAdmin();
  if(!supabase)throw new Error("Career storage unavailable.");
  const tokenIds=await syncWalletOwnership(wallet);
  if(!tokenIds.length)return[];
  const[economies,sessions,reservations,records,sponsors,trophies]=await Promise.all([
    supabase.from("goon_economies").select("token_id,grit_balance,grit_reserved").in("token_id",tokenIds),
    supabase.from("trick_line_sessions").select("token_id,target_trick_id,status").in("token_id",tokenIds).eq("status","active"),
    supabase.from("competitive_loadout_reservations").select("token_id,grit_committed,status").in("token_id",tokenIds).in("status",["reserved","locked"]),
    supabase.from("discipline_ranks").select("token_id,wins,losses,rating,discipline_rank,matches_played").in("token_id",tokenIds),
    supabase.from("athlete_sponsors").select("token_id").in("token_id",tokenIds),
    supabase.from("goon_trophies").select("token_id").in("token_id",tokenIds),
  ]);
  const economyById=new Map((economies.data??[]).map(row=>[row.token_id,row]));
  const sessionById=new Map((sessions.data??[]).map(row=>[row.token_id,row]));
  const reservationById=new Map((reservations.data??[]).map(row=>[row.token_id,row]));
  const recordById=new Map((records.data??[]).map(row=>[row.token_id,row]));
  const counts=(rows:{token_id:number}[]|null)=>rows?.reduce((map,row)=>map.set(row.token_id,(map.get(row.token_id)??0)+1),new Map<number,number>())??new Map<number,number>();
  const sponsorCounts=counts(sponsors.data),trophyCounts=counts(trophies.data);
  return tokenIds.map(tokenId=>{
    const token=collection.tokens[tokenId-1],economy=economyById.get(tokenId)??{grit_balance:0,grit_reserved:0},session=sessionById.get(tokenId),reservation=reservationById.get(tokenId);
    return{tokenId,goon:{name:token.name,imageUrl:goonImageUrl(tokenId),discipline:token.discipline,rarity:token.rarity},economy:{grit_balance:Number(economy.grit_balance??0),grit_reserved:Number(economy.grit_reserved??0)},record:recordById.get(tokenId)??{wins:0,losses:0,rating:1500,discipline_rank:null,matches_played:0},sponsorCount:sponsorCounts.get(tokenId)??0,trophyCount:trophyCounts.get(tokenId)??0,activeTrickLineTarget:session?.target_trick_id??null,activeMatchCommitment:reservation?.grit_committed??null};
  });
}

export async function getSponsorOffers(wallet:string){const supabase=getSupabaseAdmin();if(!supabase)throw new Error("Sponsor storage unavailable.");const owned=await syncWalletOwnership(wallet);if(!owned.length)return[];const {data,error}=await supabase.from("athlete_sponsor_offers").select("id,token_id,milestone_wins,first_sponsor_id,second_sponsor_id,status,offered_at").in("token_id",owned).eq("status","pending").order("offered_at");if(error)throw new Error(error.message);return data??[];}

export async function acceptSponsorOffer(wallet:string,input:{offerId:string;tokenId:number;sponsorId:string}){if(!await verifyTokenOwnership(wallet,input.tokenId))throw new Error("LIVE_OWNERSHIP_CHANGED");const supabase=getSupabaseAdmin();if(!supabase)throw new Error("Sponsor storage unavailable.");const {data,error}=await supabase.rpc("accept_sponsor_offer",{p_offer_id:input.offerId,p_token_id:input.tokenId,p_sponsor_id:input.sponsorId,p_wallet:wallet.toLowerCase()});if(error)throw new Error(error.message);return data;}

export async function startTrickLine(input: { wallet: string | null; tokenId?: number; targetTrickId?: number }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("GOONIVERSE_DATABASE_UNAVAILABLE");
  if (!input.wallet || !input.tokenId) throw new Error("OWNED_GOON_REQUIRED");
  const tokenId = validTokenId(input.tokenId);
  const athlete = athleteFor(tokenId);
  if (!await verifyTokenOwnership(input.wallet, tokenId)) throw new Error("LIVE_OWNERSHIP_REQUIRED");
  const target = TRICK_CATALOG[athlete.discipline].find((trick) => trick.id === Number(input.targetTrickId) && trick.id >= 4);
  if (!target) throw new Error("LOCKED_ADVANCED_TRICK_REQUIRED");
  const [{ data: progress }, { data: mastery }, { data: economy }] = await Promise.all([
    supabase.from("athlete_sponsor_progress").select("unlocked_trick_bitmap").eq("token_id", tokenId).maybeSingle(),
    supabase.from("goon_trick_mastery").select("failed_qualified_runs,qualified_runs,unlocked_at").eq("token_id", tokenId).eq("trick_id", target.id).maybeSingle(),
    supabase.from("goon_economies").select("grit_balance,grit_reserved").eq("token_id", tokenId).maybeSingle(),
  ]);
  if (bitmapUnlocked(progress?.unlocked_trick_bitmap, target.id) || mastery?.unlocked_at) throw new Error("TRICK_ALREADY_UNLOCKED");
  const entryCost = masteryEntryCost(target.difficulty);
  const spendable = Number(economy?.grit_balance ?? 0) - Number(economy?.grit_reserved ?? 0);
  if (spendable < entryCost) throw new Error("INSUFFICIENT_GRIT");
  const failed = Number(mastery?.failed_qualified_runs ?? 0);
  const chance = masteryUnlockChance(target.difficulty, failed);
  const seed = randomBytes(32).toString("hex");
  const accessKey = randomBytes(24).toString("base64url");
  const actionDeadline = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data, error } = await supabase.rpc("start_trick_line_mastery", { p_token_id: tokenId, p_wallet: input.wallet, p_target_trick_id: target.id, p_entry_cost: entryCost, p_discipline: athlete.discipline, p_seed_commitment: sha256(seed), p_server_seed: seed, p_access_key_hash: sha256(accessKey), p_action_deadline: actionDeadline, p_mastery_chance: chance });
  if (error) throw error;
  return {
    session: sanitizeSession(data as SessionRow),
    accessKey,
    goon: publicGoon(tokenId),
    tricks: TRICK_CATALOG[athlete.discipline].slice(0, 4), target,
    obstacles: TRICK_LINE_OBSTACLES[athlete.discipline],
    mastery: { entryCost, currentGrit: Number(economy?.grit_balance ?? 0), remainingGrit: spendable - entryCost, chance, failedQualifiedRuns: failed, guaranteeRun: masteryGuaranteeRun(target.difficulty) },
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
  const tokenId = session.token_id!;
  const athlete = athleteFor(tokenId);
  const trick = TRICK_CATALOG[session.discipline].find((candidate) => candidate.id === Number(input.trickId));
  if (!trick) throw new Error("INVALID_TRICK");
  const obstacle = String(input.obstacle ?? "");
  if (!TRICK_LINE_OBSTACLES[session.discipline].includes(obstacle)) throw new Error("INVALID_OBSTACLE");
  const stance = input.stance === "switch" ? "switch" : "regular";
  const mode = input.mode === "send" ? "send" : "standard";
  const gritUsed = 0;
  const targetStep = expectedSequence === 2;
  if (expectedSequence > 2) throw new Error("BANK_THE_QUALIFIED_LINE");
  if (targetStep && Number(input.trickId) !== session.target_trick_id) throw new Error("TARGET_TRICK_REQUIRED");
  if (!targetStep && Number(input.trickId) === session.target_trick_id) throw new Error("LAND_TWO_SETUP_TRICKS_FIRST");
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
  let unlock = false;
  const qualified = session.action_sequence === 3 && session.landed_count === 3;
  if (session.token_id) {
    const base = { p_token_id: session.token_id, p_source_type: "trick_line", p_source_id: session.id, p_actor_wallet: wallet };
    const events = [];
    if (rewards.xp) events.push(supabase.rpc("apply_goon_economy_event", { ...base, p_idempotency_key: `trick-line:${session.id}:bank`, p_event_type: "reward", p_grit_balance_delta: 0, p_xp_delta: rewards.xp }));
    if (rewards.materialQuantity) events.push(supabase.rpc("apply_goon_economy_event", { ...base, p_idempotency_key: `trick-line:${session.id}:material`, p_event_type: "reward", p_material_key: rewards.material, p_material_delta: rewards.materialQuantity }));
    const results = await Promise.all(events);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    if (qualified) {
      const { data: mastery } = await supabase.from("goon_trick_mastery").select("failed_qualified_runs").eq("token_id",session.token_id).eq("trick_id",session.target_trick_id!).maybeSingle();
      const target = TRICK_CATALOG[session.discipline].find((trick) => trick.id === session.target_trick_id)!;
      unlock = masteryAttemptUnlocks(target.difficulty, Number(mastery?.failed_qualified_runs ?? 0), deterministicRoll(session.server_seed, 999));
    }
    await supabase.rpc("settle_trick_line_mastery", { p_session_id: session.id, p_qualified: qualified, p_unlocked: unlock });
    await supabase.from("trick_line_sessions").update({ reward_claimed: true }).eq("id", session.id).eq("reward_claimed", false);
  }
  return { session: { ...sanitizeSession(data as SessionRow), masteryQualified: qualified, masteryUnlocked: unlock }, rewards, mastery: { qualified, unlocked: unlock } };
}
