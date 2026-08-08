import "server-only";

import { getAddress, isAddress } from "viem";
import { publicClient, ZERO_ADDRESS } from "@/lib/contracts";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const matchEscrowAbi = [
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "settlementSigner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "feeRecipient", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "houseFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "matchOf", stateMutability: "view", inputs: [{ name: "matchId", type: "bytes32" }], outputs: [{ name: "wager", type: "tuple", components: [
    { name: "termsHash", type: "bytes32" }, { name: "playerA", type: "address" }, { name: "playerB", type: "address" },
    { name: "stake", type: "uint128" }, { name: "scheduledStart", type: "uint64" }, { name: "fundingDeadline", type: "uint64" },
    { name: "disputeDeadline", type: "uint64" }, { name: "feeBps", type: "uint16" }, { name: "fundedA", type: "bool" },
    { name: "fundedB", type: "bool" }, { name: "state", type: "uint8" }, { name: "proposedWinner", type: "address" },
    { name: "feeRecipient", type: "address" }, { name: "matchSettlementSigner", type: "address" }, { name: "resultHash", type: "bytes32" },
  ] }] },
] as const;

const CHAIN_STATES = ["none", "created", "partially_funded", "locked", "result_proposed", "settled", "refunded", "voided", "disputed"] as const;

function configuredAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !isAddress(value) || value.toLowerCase() === ZERO_ADDRESS) return null;
  return getAddress(value);
}

export async function getMatchWager(matchId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Wager storage is not configured.");
  const [{ data: match, error: matchError }, { data: reference, error: referenceError }] = await Promise.all([
    supabase.from("pvp_matches").select("id,status,first_token_id,second_token_id,first_wallet_address,second_wallet_address,scheduled_start_at,ruleset_hash,result_hash,winner_token_id").eq("id", matchId).single(),
    supabase.from("match_wager_references").select("*").eq("match_id", matchId).maybeSingle(),
  ]);
  if (matchError || !match) throw new Error(matchError?.message ?? "Match not found.");
  if (referenceError) throw new Error(referenceError.message);
  const requested = Boolean(reference && reference.state !== "disabled");
  const escrowAddress = configuredAddress(process.env.MATCH_ESCROW_ADDRESS ?? process.env.NEXT_PUBLIC_MATCH_ESCROW_ADDRESS);
  const settlementSigner = configuredAddress(process.env.MATCH_SETTLEMENT_SIGNER_ADDRESS);
  const feeRecipient = configuredAddress(process.env.MATCH_ESCROW_FEE_RECIPIENT_ADDRESS);
  const enabled = requested && process.env.WAGERING_ENABLED === "true" && Boolean(escrowAddress && settlementSigner && feeRecipient);
  const fundingDeadline = reference?.funding_deadline ? new Date(reference.funding_deadline) : null;
  const scheduledStart = match.scheduled_start_at ? new Date(match.scheduled_start_at) : null;
  let chain = null;
  let configValid = false;
  if (requested && escrowAddress && reference?.escrow_match_id) {
    try {
      const [paused, chainSigner, chainFeeRecipient, chainFeeBps, wager] = await Promise.all([
        publicClient.readContract({ address: escrowAddress, abi: matchEscrowAbi, functionName: "paused" }),
        publicClient.readContract({ address: escrowAddress, abi: matchEscrowAbi, functionName: "settlementSigner" }),
        publicClient.readContract({ address: escrowAddress, abi: matchEscrowAbi, functionName: "feeRecipient" }),
        publicClient.readContract({ address: escrowAddress, abi: matchEscrowAbi, functionName: "houseFeeBps" }),
        publicClient.readContract({ address: escrowAddress, abi: matchEscrowAbi, functionName: "matchOf", args: [reference.escrow_match_id as `0x${string}`] }),
      ]);
      configValid = Boolean(settlementSigner && feeRecipient)
        && getAddress(chainSigner) === settlementSigner
        && getAddress(chainFeeRecipient) === feeRecipient
        && Number(chainFeeBps) === Number(reference.house_fee_bps ?? 0);
      chain = {
        paused, state: CHAIN_STATES[Number(wager.state)] ?? "unknown", fundedA: wager.fundedA, fundedB: wager.fundedB,
        termsHash: wager.termsHash, disputeDeadline: Number(wager.disputeDeadline), resultHash: wager.resultHash,
      };
    } catch {
      chain = null;
    }
  }
  const terms = requested && escrowAddress && settlementSigner && feeRecipient && fundingDeadline && scheduledStart ? {
    matchId: reference.escrow_match_id,
    playerA: getAddress(match.first_wallet_address), playerB: getAddress(match.second_wallet_address),
    tokenA: String(match.first_token_id), tokenB: String(match.second_token_id), stake: String(reference.stake_minor),
    scheduledStart: String(Math.floor(scheduledStart.getTime() / 1000)), fundingDeadline: String(Math.floor(fundingDeadline.getTime() / 1000)),
    rulesetHash: match.ruleset_hash, settlementSigner, feeBps: Number(reference.house_fee_bps ?? 0), feeRecipient,
  } : null;
  return {
    requested, enabled: enabled && configValid && chain?.paused === false, configured: enabled && configValid,
    escrowAddress, usdcAddress: configuredAddress(process.env.BASE_USDC_ADDRESS ?? process.env.NEXT_PUBLIC_BASE_USDC_ADDRESS),
    state: chain?.state === "none" || !chain ? reference?.state ?? "disabled" : chain.state,
    stakeMinor: reference?.stake_minor ?? null, houseFeeBps: reference?.house_fee_bps ?? 0,
    fundingDeadline: reference?.funding_deadline ?? null, chain, terms,
    notice: !requested ? "This is a no-wager ranked match."
      : !enabled ? "USDC escrow configuration is not active. No funding transaction is available."
        : !configValid ? "The deployed escrow configuration does not match this match. Funding is blocked."
          : chain?.paused ? "The escrow is deployed but paused by the Gravity Goons Safe."
            : "Both players lock the same native Base USDC stake before check-in. Completed payouts have a 24-hour dispute window.",
  };
}

export async function syncMatchWager(matchId: string, wallet: string, txHash?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Wager storage is not configured.");
  const { data: match } = await supabase.from("pvp_matches").select("first_wallet_address,second_wallet_address").eq("id", matchId).single();
  const normalized = wallet.toLowerCase();
  if (!match || ![match.first_wallet_address, match.second_wallet_address].includes(normalized)) throw new Error("Only match players can sync funding.");
  const detail = await getMatchWager(matchId);
  if (!detail.chain) throw new Error("The escrow state is not available on Base.");
  const updates: Record<string, unknown> = { state: detail.chain.state, terms_hash: detail.chain.termsHash, last_chain_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (detail.chain.disputeDeadline) updates.dispute_deadline = new Date(detail.chain.disputeDeadline * 1000).toISOString();
  if (txHash && /^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    if (normalized === match.first_wallet_address && detail.chain.fundedA) updates.funded_a_tx_hash = txHash;
    if (normalized === match.second_wallet_address && detail.chain.fundedB) updates.funded_b_tx_hash = txHash;
  }
  const { error } = await supabase.from("match_wager_references").update(updates).eq("match_id", matchId);
  if (error) throw new Error(error.message);
  return getMatchWager(matchId);
}
