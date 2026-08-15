import { NextResponse } from "next/server";
import { reportChatRoomMessage } from "@/lib/chat-server";
import { requireSessionAddress } from "@/lib/request-auth";
export async function POST(request: Request) {
  try { const wallet = await requireSessionAddress(); const body = await request.json() as { messageId?: string }; if (!body.messageId) throw new Error("Choose a message."); return NextResponse.json(await reportChatRoomMessage(wallet, body.messageId)); }
  catch (error) { const message = error instanceof Error ? error.message : "Report failed."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
