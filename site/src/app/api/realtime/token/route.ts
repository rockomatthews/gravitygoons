import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export async function POST() {
  try {
    const address = await requireSessionAddress();
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return NextResponse.json({ error: "Private realtime is not configured." }, { status: 503 });
    const now = Math.floor(Date.now() / 1000);
    const header = encode({ alg: "HS256", typ: "JWT" });
    const payload = encode({ aud: "authenticated", role: "authenticated", sub: address, wallet_address: address, iat: now, exp: now + 15 * 60 });
    const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    return NextResponse.json({ token: `${header}.${payload}.${signature}`, address, expiresAt: (now + 15 * 60) * 1000 });
  } catch {
    return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  }
}
