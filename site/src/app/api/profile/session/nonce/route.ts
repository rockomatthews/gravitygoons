import { NextResponse } from "next/server";
import { createSignInChallenge, NONCE_COOKIE } from "@/lib/profile-session";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { address?: string };
    if (!body.address) return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
    const challenge = createSignInChallenge(body.address);
    const response = NextResponse.json({ message: challenge.message, expiresAt: challenge.expiresAt });
    response.cookies.set(NONCE_COOKIE, challenge.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create sign-in challenge." }, { status: 400 });
  }
}

