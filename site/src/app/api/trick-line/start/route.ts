import { NextResponse } from "next/server";
import { readSessionAddress } from "@/lib/profile-session";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/profile-session";
import { startTrickLine } from "@/lib/gooniverse-server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { tokenId?: number; targetTrickId?: number };
    const cookieStore = await cookies();
    const wallet = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
    if (body.tokenId && !wallet) throw new Error("AUTH_REQUIRED");
    return NextResponse.json(await startTrickLine({ wallet, tokenId: body.tokenId, targetTrickId: body.targetTrickId }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Trick Line.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
