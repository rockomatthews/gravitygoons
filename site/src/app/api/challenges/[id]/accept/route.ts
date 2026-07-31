import { NextResponse } from "next/server";
import { transitionChallenge } from "@/lib/challenges";
import { requireSessionAddress } from "@/lib/request-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]);
    return NextResponse.json(await transitionChallenge(wallet, id, "accept", body.issuedAt, body.signature));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept challenge.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
