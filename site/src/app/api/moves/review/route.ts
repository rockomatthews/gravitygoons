import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { reviewMoveAsset } from "@/lib/move-cinema-server";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with the owner wallet first." }, { status: 401 });
  try {
    const body = await request.json() as { assetId?: string; decision?: "approved" | "rejected" | "reroll"; note?: string };
    if (!body.assetId || !body.decision || !["approved", "rejected", "reroll"].includes(body.decision)) return NextResponse.json({ error: "Draft and review decision are required." }, { status: 400 });
    console.info("move_review_requested", { assetId: body.assetId, decision: body.decision });
    const result = await reviewMoveAsset(address, body.assetId, body.decision, body.note);
    console.info("move_review_completed", { assetId: body.assetId, decision: body.decision });
    return NextResponse.json(result);
  } catch (error) {
    console.error("move_review_failed", { reason: error instanceof Error ? error.message : "Unknown move review failure." });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to review movie draft." }, { status: 400 });
  }
}
