import "server-only";

import { createHash } from "node:crypto";
import { getAddress, verifyMessage } from "viem";
import { publicClient } from "@/lib/contracts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function message(wallet: string, matchId: string, proposedStartAt: string, issuedAt: string) {
  return ["Gravity Goons match reschedule", `Wallet: ${wallet.toLowerCase()}`, `Match: ${matchId}`, `New start: ${proposedStartAt}`, `Issued: ${issuedAt}`, "Both players must approve. Any spectator market will be suspended."].join("\n");
}

async function verify(wallet: string, matchId: string, proposedStartAt: string, issuedAt: string, signature: `0x${string}`) {
  const issued = Date.parse(issuedAt);
  const start = Date.parse(proposedStartAt);
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > 5 * 60_000) throw new Error("Confirmation expired. Sign again.");
  if (!Number.isFinite(start) || start < Date.now() + 30 * 60_000 || start > Date.now() + 7 * 24 * 60 * 60_000) throw new Error("New start must be 30 minutes to 7 days ahead.");
  const text = message(wallet, matchId, proposedStartAt, issuedAt);
  let valid = await verifyMessage({ address: getAddress(wallet), message: text, signature });
  if (!valid) valid = await publicClient.verifyMessage({ address: getAddress(wallet), message: text, signature }).catch(() => false);
  if (!valid) throw new Error("Invalid wallet confirmation.");
  return `0x${createHash("sha256").update(text).digest("hex")}`;
}

export async function rescheduleMatch(wallet: string, matchId: string, input: { requestId?: string; proposedStartAt: string; issuedAt: string; signature: `0x${string}` }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Match storage is not configured.");
  const { data: match } = await supabase.from("pvp_matches").select("id,status,match_mode,first_wallet_address,second_wallet_address,scheduled_start_at").eq("id", matchId).maybeSingle();
  if (!match || match.match_mode !== "live_ranked") throw new Error("Scheduled match not found.");
  const normalized = wallet.toLowerCase();
  if (![match.first_wallet_address, match.second_wallet_address].includes(normalized)) throw new Error("Only match players can reschedule.");
  if (match.status !== "queued") throw new Error("A match can only be rescheduled before it starts.");
  const confirmationHash = await verify(normalized, matchId, input.proposedStartAt, input.issuedAt, input.signature);
  if (!input.requestId) {
    const { data, error } = await supabase.from("match_reschedule_requests").insert({ match_id: matchId, proposer_wallet: normalized, proposed_start_at: input.proposedStartAt, confirmation_hash: confirmationHash }).select("id,status,proposed_start_at,expires_at").single();
    if (error) throw new Error(error.code === "23505" ? "A reschedule proposal is already awaiting approval." : error.message);
    return { request: data, accepted: false };
  }
  const { data: proposal } = await supabase.from("match_reschedule_requests").select("*").eq("id", input.requestId).eq("match_id", matchId).eq("status", "proposed").maybeSingle();
  if (!proposal || proposal.expires_at <= new Date().toISOString()) throw new Error("Reschedule proposal is missing or expired.");
  if (proposal.proposer_wallet === normalized) throw new Error("The other player must approve the reschedule.");
  if (proposal.proposed_start_at !== input.proposedStartAt) throw new Error("Signed time does not match the proposal.");
  const { error } = await supabase.from("pvp_matches").update({
    scheduled_start_at: input.proposedStartAt,
    check_in_opens_at: new Date(Date.parse(input.proposedStartAt) - 15 * 60_000).toISOString(),
    betting_closes_at: input.proposedStartAt,
    first_checked_in_at: null, second_checked_in_at: null, updated_at: new Date().toISOString(),
  }).eq("id", matchId).eq("status", "queued");
  if (error) throw new Error(error.message);
  const { error: requestError } = await supabase.from("match_reschedule_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", proposal.id);
  if (requestError) throw new Error(requestError.message);
  const { error: rescheduledEventError } = await supabase.rpc("next_arena_event", { p_match_id: matchId, p_event_type: "rescheduled", p_public_payload: { scheduledStartAt: input.proposedStartAt } });
  if (rescheduledEventError) throw new Error(rescheduledEventError.message);
  const { error: marketEventError } = await supabase.rpc("next_arena_event", { p_match_id: matchId, p_event_type: "market_suspended", p_public_payload: { reason: "rescheduled" } });
  if (marketEventError) throw new Error(marketEventError.message);
  return { requestId: proposal.id, accepted: true, scheduledStartAt: input.proposedStartAt };
}

export { message as rescheduleConfirmationMessage };
