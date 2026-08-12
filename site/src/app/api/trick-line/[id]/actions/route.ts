import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";
import { playTrickLineAction } from "@/lib/gooniverse-server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body, cookieStore] = await Promise.all([context.params, request.json(), cookies()]);
    const wallet = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
    return NextResponse.json(await playTrickLineAction(wallet, id, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve the trick.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
