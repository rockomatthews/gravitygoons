import { NextResponse } from "next/server";
import { claimPendingAcademiaRewards } from "@/lib/academia/server";
import { requireSessionAddress } from "@/lib/request-auth";

export async function POST(request: Request) {
  try { const [wallet, body] = await Promise.all([requireSessionAddress(), request.json()]); return NextResponse.json(await claimPendingAcademiaRewards(wallet, Number(body.tokenId))); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to claim Academia GRIT."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
