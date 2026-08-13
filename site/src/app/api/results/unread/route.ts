import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
export async function GET(){try{const wallet=await requireSessionAddress(),db=getSupabaseAdmin();if(!db)throw new Error("Result storage unavailable.");const {data,error}=await db.from("match_result_receipts").select("*").eq("wallet_address",wallet.toLowerCase()).is("acknowledged_at",null).order("created_at").limit(1);if(error)throw error;return NextResponse.json({receipt:data?.[0]??null});}catch(error){const message=error instanceof Error?error.message:"Unable to load results.";return NextResponse.json({error:message},{status:message==="AUTH_REQUIRED"?401:400});}}
