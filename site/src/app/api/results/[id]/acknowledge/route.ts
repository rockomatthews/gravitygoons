import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
export async function POST(_request:Request,context:{params:Promise<{id:string}>}){try{const [{id},wallet]=await Promise.all([context.params,requireSessionAddress()]),db=getSupabaseAdmin();if(!db)throw new Error("Result storage unavailable.");const {error}=await db.from("match_result_receipts").update({acknowledged_at:new Date().toISOString()}).eq("id",id).eq("wallet_address",wallet.toLowerCase());if(error)throw error;return NextResponse.json({acknowledged:true});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to acknowledge result."},{status:400});}}
