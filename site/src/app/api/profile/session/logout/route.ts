import { NextResponse } from "next/server";
import { NONCE_COOKIE, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(NONCE_COOKIE);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

