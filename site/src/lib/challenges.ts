import { createHash } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import collection from "@/data/collection.json";
import { collectionAbi, collectionAddress, publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { verifyTokenOwnership } from "@/lib/profile-data";

export const CHALLENGE_TTL_HOURS = 72;
const DISCIPLINES = ["Skateboarding", "Snowboarding", "Surfing", "BMX", "Motocross", "Skiing"] as const;

export type ChallengeConfirmation = {
  action: "create" | "accept" | "decline" | "cancel";
  challengeId?: string;
  challengerTokenId?: number;
  challengedTokenId?: number;
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
    `Issued: ${input.issuedAt}`,
    "Ranked play only. No wager or token transfer.",
  ].filter(Boolean).join("\n");
}

export async function verifyChallengeConfirmation(wallet: string, input: ChallengeConfirmation, signature: `0x${string}`) {
  const issued = Date.parse(input.issuedAt);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 5 * 60_000) throw new Error("Confirmation expired. Sign again.");
  const message = challengeConfirmationMessage(wallet, input);
  const valid = await verifyMessage({ address: getAddress(wallet), message, signature });
  if (!valid) throw new Error("Invalid wallet confirmation.");
  return `0x${createHash("sha256").update(message).digest("hex")}`;
}

async function onchainOwner(tokenId: number): Promise<string> {
  if (collectionAddress === ZERO_ADDRESS) throw new Error("Collection contract is not configured.");
  return String(await publicClient.readContract({ address: collectionAddress, abi: collectionAbi, functionName: "ownerOf", args: [BigInt(tokenId)] })).toLowerCase();
}

export async function createChallenge(wallet: string, input: { challengerTokenId: number; challengedTokenId: number; issuedAt: string; signature: `0x${string}` }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Challenge storage is not configured.");
  const first = collection.tokens[input.challengerTokenId - 1];
  const second = collection.tokens[input.challengedTokenId - 1];
  if (!first || !second) throw new Error("Unknown Goon.");
  if (first.discipline !== second.discipline) throw new Error("Challenges require the same discipline.");
  if (input.challengerTokenId === input.challengedTokenId) throw new Error("A Goon cannot challenge itself.");
  const confirmationHash = await verifyChallengeConfirmation(wallet, {
    action: "create", challengerTokenId: input.challengerTokenId, challengedTokenId: input.challengedTokenId, issuedAt: input.issuedAt,
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
  return {
    incoming: rows.filter((row) => row.status === "incoming" && row.challenged_wallet === wallet.toLowerCase()),
    sent: rows.filter((row) => row.status === "incoming" && row.challenger_wallet === wallet.toLowerCase()),
    active: rows.filter((row) => ["accepted", "active"].includes(row.status)),
    history: rows.filter((row) => ["declined", "cancelled", "expired", "completed"].includes(row.status)),
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
