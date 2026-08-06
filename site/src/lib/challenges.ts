import { createHash } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import collection from "@/data/collection.json";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTokenOwnership } from "@/lib/profile-data";
import { ACTIVE_RULESET_HASH, MATCH_MODES, type MatchMode, STAKE_TIERS_MINOR } from "@/lib/match-terms";

export const CHALLENGE_TTL_HOURS = 72;
const DISCIPLINES = ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"] as const;

export type ChallengeConfirmation = {
  action: "create" | "accept" | "decline" | "cancel";
  challengeId?: string;
  challengerTokenId?: number;
  challengedTokenId?: number;
  matchMode?: MatchMode;
  proposedStartAt?: string | null;
  rulesetHash?: string;
  wagerRequested?: boolean;
  stakeMinor?: number | null;
  houseFeeBps?: number;
  issuedAt: string;
};

export function challengeConfirmationMessage(wallet: string, input: ChallengeConfirmation): string {
  return [
    "Gravity Goons ranked challenge",
    `Action: ${input.action}`,
    `Wallet: ${wallet.toLowerCase()}`,
    input.challengeId ? `Challenge: ${input.challengeId}` : "",
    input.challengerTokenId ? `Your Goon: #${String(input.challengerTokenId).padStart(4, "0")}` : "",
    input.challengedTokenId ? `Opponent Goon: #${String(input.challengedTokenId).padStart(4, "0")}` : "",
    input.matchMode ? `Mode: ${input.matchMode}` : "",
    input.proposedStartAt ? `Scheduled: ${input.proposedStartAt}` : "",
    input.rulesetHash ? `Ruleset: ${input.rulesetHash}` : "",
    input.wagerRequested != null ? `USDC wager requested: ${input.wagerRequested ? "yes" : "no"}` : "",
    input.stakeMinor ? `Stake minor units: ${input.stakeMinor}` : "",
    input.houseFeeBps != null ? `House fee bps: ${input.houseFeeBps}` : "",
    `Issued: ${input.issuedAt}`,
    "Ranked play only. No wager or token transfer.",
  ].filter(Boolean).join("\n");
}

export async function verifyChallengeConfirmation(wallet: string, input: ChallengeConfirmation, signature: `0x${string}`) {
  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 5 * 60_000) throw new Error("Confirmation expired. Sign again.");
  const message = challengeConfirmationMessage(wallet, input);
  let valid = await verifyMessage({ address: getAddress(wallet), message, signature });
  if (!valid) valid = await publicClient.verifyMessage({ address: getAddress(wallet), message, signature }).catch(() => false);
  if (!valid) throw new Error("Invalid wallet confirmation.");
  return `0x${createHash("sha256").update(message).digest("hex")}`;
}

async function onchainOwner(tokenId: number): Promise<string> {
  if (collectionAddress === ZERO_ADDRESS) throw new Error("Collection contract is not configured.");
  return String(await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(tokenId)] })).toLowerCase();
}

export async function createChallenge(wallet: string, input: { challengerTokenId: number; challengedTokenId: number; matchMode?: MatchMode; proposedStartAt?: string | null; wagerRequested?: boolean; stakeMinor?: number | null; issuedAt: string; signature: `0x${string}` }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Challenge storage is not configured.");
  const first = collection.tokens[input.challengerTokenId - 1];
  const second = collection.tokens[input.challengedTokenId - 1];
  if (!first || !second) throw new Error("Unknown Goon.");
  if (first.discipline !== second.discipline) throw new Error("Challenges require the same discipline.");
  if (input.challengerTokenId === input.challengedTokenId) throw new Error("A Goon cannot challenge itself.");
  const matchMode = input.matchMode ?? "live_ranked";
  if (!MATCH_MODES.includes(matchMode)) throw new Error("Unknown match mode.");
  const proposedStartAt = input.proposedStartAt ?? null;
  const start = Date.parse(proposedStartAt ?? "");
  if (!Number.isFinite(start) || start < Date.now() + 30 * 60_000 || start > Date.now() + 7 * 24 * 60 * 60_000) throw new Error("Live matches must be scheduled 30 minutes to 7 days ahead.");
  const wagerRequested = Boolean(input.wagerRequested);
  if (wagerRequested && process.env.WAGERING_ENABLED !== "true") throw new Error("Real-USDC match wagering is not enabled.");
  const stakeMinor = wagerRequested && STAKE_TIERS_MINOR.includes(Number(input.stakeMinor) as typeof STAKE_TIERS_MINOR[number]) ? Number(input.stakeMinor) : null;
  if (wagerRequested && !stakeMinor) throw new Error("Choose an approved USDC stake tier.");
  const confirmationHash = await verifyChallengeConfirmation(wallet, {
    action: "create", challengerTokenId: input.challengerTokenId, challengedTokenId: input.challengedTokenId,
    matchMode, proposedStartAt, rulesetHash: ACTIVE_RULESET_HASH, wagerRequested, stakeMinor, houseFeeBps: 0, issuedAt: input.issuedAt,
  }, input.signature);
  if (!await verifyTokenOwnership(wallet, input.challengerTokenId)) throw new Error("You no longer own the challenging Goon.");
  const challengedWallet = await onchainOwner(input.challengedTokenId);
  if (challengedWallet === wallet.toLowerCase()) throw new Error("You cannot challenge your own Goon.");
  const { data: locks } = await supabase.from("pvp_token_locks").select("token_id").in("token_id", [input.challengerTokenId, input.challengedTokenId]);
  if (locks?.length) throw new Error("One of these Goons is already in an active match.");
  const discipline = DISCIPLINES.indexOf(first.discipline as typeof DISCIPLINES[number]);
  const { data, error } = await supabase.from("game_challenges").insert({
    challenger_token_id: input.challengerTokenId,
    challenged_token_id: input.challengedTokenId,
    challenger_wallet: wallet.toLowerCase(),
    challenged_wallet: challengedWallet,
    discipline,
    confirmation_hash: confirmationHash,
    match_mode: matchMode,
    proposed_start_at: proposedStartAt,
    ruleset_hash: ACTIVE_RULESET_HASH,
    wager_requested: wagerRequested,
    stake_minor: stakeMinor,
    house_fee_bps: 0,
  }).select("*").single();
  if (error) throw new Error(error.code === "23505" ? "A challenge between these Goons is already pending." : error.message);
  await supabase.from("challenge_events").insert({ challenge_id: data.id, actor_wallet: wallet.toLowerCase(), event_type: "created" });
  return data;
}

export async function listChallenges(wallet: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { incoming: [], sent: [], active: [], history: [] };
  await supabase.from("game_challenges").update({ status: "expired", updated_at: new Date().toISOString() }).eq("status", "incoming").lt("expires_at", new Date().toISOString());
  const { data, error } = await supabase.from("game_challenges").select("*").or(`challenger_wallet.eq.${wallet.toLowerCase()},challenged_wallet.eq.${wallet.toLowerCase()}`).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const matchIds = rows.map((row) => row.match_id).filter(Boolean);
  const { data: reschedules } = matchIds.length
    ? await supabase.from("match_reschedule_requests").select("id,match_id,proposer_wallet,proposed_start_at,status,expires_at").in("match_id", matchIds).eq("status", "proposed")
    : { data: [] };
  const byMatch = new Map((reschedules ?? []).map((row) => [row.match_id, row]));
  const expanded = rows.map((row) => ({ ...row, reschedule_request: row.match_id ? byMatch.get(row.match_id) ?? null : null }));
  return {
    incoming: expanded.filter((row) => row.status === "incoming" && row.challenged_wallet === wallet.toLowerCase()),
    sent: expanded.filter((row) => row.status === "incoming" && row.challenger_wallet === wallet.toLowerCase()),
    active: expanded.filter((row) => ["accepted", "active"].includes(row.status)),
    history: expanded.filter((row) => ["declined", "cancelled", "expired", "completed"].includes(row.status)),
  };
}

export async function transitionChallenge(wallet: string, challengeId: string, action: "accept" | "decline" | "cancel", issuedAt: string, signature: `0x${string}`) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Challenge storage is not configured.");
  await verifyChallengeConfirmation(wallet, { action, challengeId, issuedAt }, signature);
  const { data: challenge } = await supabase.from("game_challenges").select("*").eq("id", challengeId).single();
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status !== "incoming") throw new Error("Challenge is no longer pending.");
  if (action === "accept") {
    if (challenge.match_mode !== "live_ranked" || !challenge.proposed_start_at) throw new Error("Gravity Goons ranked matches are live-only. Create a new scheduled challenge.");
    const ownership = await Promise.all([
      verifyTokenOwnership(challenge.challenger_wallet, challenge.challenger_token_id),
      verifyTokenOwnership(challenge.challenged_wallet, challenge.challenged_token_id),
    ]);
    if (ownership.some((value) => !value)) throw new Error("Live ownership changed. The challenge cannot be accepted.");
    const { data, error } = await supabase.rpc("accept_game_challenge", { p_challenge_id: challengeId, p_actor_wallet: wallet.toLowerCase() });
    if (error) throw new Error(error.message);
    return { challengeId, matchId: data };
  }
  const ownsAction = action === "decline"
    ? challenge.challenged_wallet === wallet.toLowerCase()
    : challenge.challenger_wallet === wallet.toLowerCase();
  if (!ownsAction) throw new Error(`Only the ${action === "decline" ? "challenged" : "challenging"} owner can ${action}.`);
  const status = action === "decline" ? "declined" : "cancelled";
  const { error } = await supabase.from("game_challenges").update({ status, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", challengeId).eq("status", "incoming");
  if (error) throw new Error(error.message);
  await supabase.from("challenge_events").insert({ challenge_id: challengeId, actor_wallet: wallet.toLowerCase(), event_type: status });
  return { challengeId, status };
}
