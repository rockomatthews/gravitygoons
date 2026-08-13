import {NextResponse} from "next/server";
import {getWalletCareerSummary} from "@/lib/gooniverse-server";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const wallet=new URL(request.url).searchParams.get("wallet");if(!wallet||!/^0x[0-9a-fA-F]{40}$/.test(wallet))throw new Error("Valid wallet required.");return NextResponse.json({careers:await getWalletCareerSummary(wallet)},{headers:{"Cache-Control":"no-store"}});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load GRIT balances."},{status:400});}}
