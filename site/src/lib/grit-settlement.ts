import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function settleMatchProgression(matchId:string,{requirePaid=false,transactionHash}:{requirePaid?:boolean;transactionHash?:string}={}){
  const db=getSupabaseAdmin();if(!db)throw new Error("Match progression storage unavailable.");
  const {data,error}=await db.rpc("settle_ranked_match_career",{p_match_id:matchId,p_paid:requirePaid,p_transaction_hash:transactionHash??null});
  if(error)throw new Error(error.message);
  return data as {settled:boolean;eligible?:boolean;duplicate?:boolean;waiting?:string};
}
