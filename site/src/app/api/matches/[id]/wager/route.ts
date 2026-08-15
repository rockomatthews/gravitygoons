import { NextResponse } from "next/server";
import { getMatchWager, syncMatchWager } from "@/lib/match-escrow";
import { requireSessionAddress } from "@/lib/request-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try { return NextResponse.json(await getMatchWager(id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Match not found." }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]);
    return NextResponse.json(await syncMatchWager(id, wallet, body.txHash));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync wager state.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
