import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { postChatRoomMessage, readChatRoom } from "@/lib/chat-server";
import { requireSessionAddress } from "@/lib/request-auth";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function GET() {
  try { const store = await cookies(); const wallet = readSessionAddress(store.get(SESSION_COOKIE)?.value); return NextResponse.json(await readChatRoom(wallet), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Chat room unavailable." }, { status: 500 }); }
}
export async function POST(request: Request) {
  try { const wallet = await requireSessionAddress(); return NextResponse.json(await postChatRoomMessage(wallet, await request.json())); }
  catch (error) { const message = error instanceof Error ? error.message : "Post failed."; return NextResponse.json({ error: message === "AUTH_REQUIRED" ? "Sign in with your wallet first." : message === "PROFILE_REQUIRED" ? "Create a profile before posting." : message }, { status: message === "AUTH_REQUIRED" ? 401 : message === "PROFILE_REQUIRED" ? 403 : 400 }); }
}
