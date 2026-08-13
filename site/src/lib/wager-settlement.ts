import "server-only";

import { createWalletClient, getAddress, http, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { baseRpcUrl, publicClient } from "@/lib/contracts";
import { getMatchWager, syncMatchWager } from "@/lib/match-escrow";
import { matchEscrowWriteAbi, matchResultTypes, matchVoidTypes } from "@/lib/match-escrow-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { settleMatchProgression } from "@/lib/grit-settlement";

export async function processWagerSettlements() {
  if (process.env.WAGERING_ENABLED !== "true") return { processed: 0, skipped: "wagering_disabled" };
  const key = process.env.MATCH_SETTLEMENT_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
  const configuredSigner = process.env.MATCH_SETTLEMENT_SIGNER_ADDRESS;
  const supabase = getSupabaseAdmin();
  if (!key || !configuredSigner || !supabase) throw new Error("Wager settlement service is not configured.");
  const account = privateKeyToAccount(key);
  if (account.address !== getAddress(configuredSigner)) throw new Error("Settlement private key does not match MATCH_SETTLEMENT_SIGNER_ADDRESS.");
  const wallet = createWalletClient({ account, chain: base, transport: http(baseRpcUrl) });
  const { data: references, error } = await supabase.from("match_wager_references")
    .select("match_id,state").in("state", ["settlement_pending", "result_proposed", "refund_pending"]).limit(20);
  if (error) throw new Error(error.message);
  const results: Array<{ matchId: string; action?: string; error?: string }> = [];

  for (const reference of references ?? []) {
    try {
      const [{ data: match, error: matchError }, detail] = await Promise.all([
        supabase.from("pvp_matches").select("id,status,result_hash,winner_token_id,first_token_id,second_token_id,first_wallet_address,second_wallet_address").eq("id", reference.match_id).single(),
        getMatchWager(reference.match_id),
      ]);
      if (matchError || !match || !detail.escrowAddress || !detail.terms) throw new Error(matchError?.message ?? "Incomplete wager configuration.");
      const domain = { name: "Gravity Goons Match Escrow", version: "1", chainId: 8453, verifyingContract: detail.escrowAddress } as const;
      let action = "synced";
      let transactionHash: `0x${string}` | undefined;

      if (reference.state === "settlement_pending" && detail.chain?.state === "locked") {
        if (!match.result_hash || !match.winner_token_id) throw new Error("Completed wager has no authoritative result hash.");
        const winner = getAddress(match.winner_token_id === match.first_token_id ? match.first_wallet_address : match.second_wallet_address);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const signature = await account.signTypedData({ domain, types: matchResultTypes, primaryType: "MatchResult", message: {
          matchId: detail.terms.matchId, termsHash: detail.chain.termsHash, winner, resultHash: match.result_hash as `0x${string}`, deadline,
        } });
        transactionHash = await wallet.writeContract({ address: detail.escrowAddress, abi: matchEscrowWriteAbi, functionName: "proposeResult", args: [detail.terms.matchId, winner, match.result_hash as `0x${string}`, deadline, signature] });
        await publicClient.waitForTransactionReceipt({ hash: transactionHash });
        await supabase.from("match_wager_references").update({ state: "result_proposed", result_tx_hash: transactionHash, updated_at: new Date().toISOString() }).eq("match_id", match.id);
        action = "result_proposed";
      } else if (reference.state === "result_proposed" && detail.chain?.state === "result_proposed" && detail.chain.disputeDeadline * 1000 < Date.now()) {
        transactionHash = await wallet.writeContract({ address: detail.escrowAddress, abi: matchEscrowWriteAbi, functionName: "finalize", args: [detail.terms.matchId] });
        await publicClient.waitForTransactionReceipt({ hash: transactionHash });
        await supabase.from("match_wager_references").update({ state: "settled", finalization_tx_hash: transactionHash, updated_at: new Date().toISOString() }).eq("match_id", match.id);
        action = "settled";
        await settleMatchProgression(match.id,{requirePaid:true,transactionHash});
      } else if (reference.state === "refund_pending") {
        if (detail.chain?.state === "none") {
          await supabase.from("match_wager_references").update({ state: "voided", updated_at: new Date().toISOString() }).eq("match_id", match.id);
          action = "voided_unfunded";
        } else if (["created", "partially_funded"].includes(detail.chain?.state ?? "")) {
          transactionHash = await wallet.writeContract({ address: detail.escrowAddress, abi: matchEscrowWriteAbi, functionName: "refundExpired", args: [detail.terms.matchId] });
          await publicClient.waitForTransactionReceipt({ hash: transactionHash });
          action = "refunded_expired";
        } else if (detail.chain?.state === "locked") {
          const reasonHash = keccak256(toBytes(`gravity-goons:no-show:v1:${match.id}`));
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
          const signature = await account.signTypedData({ domain, types: matchVoidTypes, primaryType: "MatchVoid", message: {
            matchId: detail.terms.matchId, termsHash: detail.chain.termsHash, reasonHash, deadline,
          } });
          transactionHash = await wallet.writeContract({ address: detail.escrowAddress, abi: matchEscrowWriteAbi, functionName: "voidWithSignature", args: [detail.terms.matchId, reasonHash, deadline, signature] });
          await publicClient.waitForTransactionReceipt({ hash: transactionHash });
          action = "voided_and_refunded";
        }
      }
      await syncMatchWager(match.id, match.first_wallet_address, transactionHash);
      results.push({ matchId: match.id, action });
    } catch (caught) {
      results.push({ matchId: reference.match_id, error: caught instanceof Error ? caught.message : "Unknown settlement error" });
    }
  }
  return { processed: results.length, results };
}
