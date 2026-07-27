import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, NONCE_COOKIE, SESSION_COOKIE, verifyChallenge } from "@/lib/profile-session";
import { getProfileForWallet } from "@/lib/profile-data";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { address?: string; signature?: `0x${string}` };
    if (!body.address || !body.signature) return NextResponse.json({ error: "Wallet address and signature are required." }, { status: 400 });
    const cookieStore = await cookies();
    const address = await verifyChallenge(cookieStore.get(NONCE_COOKIE)?.value, body.address, body.signature);
    if (!address) return NextResponse.json({ error: "The wallet signature is invalid or expired." }, { status: 401 });
    const profile = await getProfileForWallet(address);
    const response = NextResponse.json({ address, profile, needsProfile: !profile });
    response.cookies.set(SESSION_COOKIE, createSessionToken(address), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60, path: "/" });
    response.cookies.delete(NONCE_COOKIE);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify wallet." }, { status: 400 });
  }
}

