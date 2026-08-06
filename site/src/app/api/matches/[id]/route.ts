import { NextResponse } from "next/server";
import { getMatch } from "@/lib/matches";
import { requireSessionAddress } from "@/lib/request-auth";

function expectedWallet(request: Request) {
  const value = request.headers.get("x-gravity-wallet");
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet] = await Promise.all([context.params, requireSessionAddress()]);
    if (expectedWallet(request) !== wallet.toLowerCase()) throw new Error("WALLET_SESSION_MISMATCH");
    return NextResponse.json({ match: await getMatch(wallet, id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load match.";
    const unauthorized = message === "AUTH_REQUIRED" || message === "WALLET_SESSION_MISMATCH";
    console.warn("[player-match] request denied", { reason: message });
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 400 });
  }
}
