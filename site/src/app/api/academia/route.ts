import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAcademiaOverview } from "@/lib/academia/server";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export const dynamic = "force-dynamic";
export async function GET() {
  try { const store = await cookies(); return NextResponse.json(await getAcademiaOverview(readSessionAddress(store.get(SESSION_COOKIE)?.value)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Academia." }, { status: 400 }); }
}
