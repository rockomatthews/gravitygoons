import { NextResponse } from "next/server";
import { startAcademiaLesson } from "@/lib/academia/server";
import { requireSessionAddress } from "@/lib/request-auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const [{ id }, wallet] = await Promise.all([context.params, requireSessionAddress()]); return NextResponse.json(await startAcademiaLesson(wallet, id), { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to start lesson."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
