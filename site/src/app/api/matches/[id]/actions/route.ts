import { NextResponse } from "next/server";
import { processMatchAction } from "@/lib/matches";
import { requireSessionAddress } from "@/lib/request-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]);
    const expectedWallet = typeof body.expectedWallet === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.expectedWallet)
      ? body.expectedWallet.toLowerCase()
      : null;
    if (expectedWallet !== wallet.toLowerCase()) throw new Error("WALLET_SESSION_MISMATCH");
    return NextResponse.json({ result: await processMatchAction(wallet, id, body) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process match action.";
    const unauthorized = message === "AUTH_REQUIRED" || message === "WALLET_SESSION_MISMATCH";
    console.warn("[player-match-action] request denied", { reason: message });
    return NextResponse.json({ error: message }, { status: unauthorized ? 401 : 400 });
  }
}
