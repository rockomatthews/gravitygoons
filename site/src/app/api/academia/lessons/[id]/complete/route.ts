import { NextResponse } from "next/server";
import { completeAcademiaLesson } from "@/lib/academia/server";
import { requireSessionAddress } from "@/lib/request-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]); return NextResponse.json(await completeAcademiaLesson(wallet, id, body)); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to complete lesson."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
