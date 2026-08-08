import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken, NONCE_COOKIE, SESSION_COOKIE, signatureByteLength, verifyChallenge } from "@/lib/profile-session";
import { getProfileForWallet } from "@/lib/profile-data";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { address?: string; signature?: `0x${string}`; method?: "message" | "typed_data" };
    if (!body.address || !body.signature) return NextResponse.json({ error: "Wallet address and signature are required." }, { status: 400 });
    const signatureBytes = signatureByteLength(body.signature);
    if (signatureBytes === null) {
      console.warn("profile_signature_rejected", { reason: "malformed_hex", method: body.method ?? "message" });
      return NextResponse.json({ error: "The wallet returned an unreadable signature. Reconnect the wallet and try again." }, { status: 400 });
    }
    const cookieStore = await cookies();
    const address = await verifyChallenge(cookieStore.get(NONCE_COOKIE)?.value, body.address, body.signature, body.method);
    if (!address) {
      console.warn("profile_signature_rejected", { reason: "verification_failed", method: body.method ?? "message", signatureBytes });
      return NextResponse.json({ error: "The wallet signature could not be verified or has expired. Reconnect and try again." }, { status: 401 });
    }
    console.info("profile_signature_verified", { method: body.method ?? "message", signatureBytes, accountType: signatureBytes === 65 ? "standard_or_smart" : "wrapped_smart_account" });
    const profile = await getProfileForWallet(address);
    const response = NextResponse.json({ address, profile, needsProfile: !profile });
    response.cookies.set(SESSION_COOKIE, createSessionToken(address), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60, path: "/" });
    response.cookies.delete(NONCE_COOKIE);
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to verify wallet." }, { status: 400 });
  }
}
