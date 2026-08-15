import { NextRequest, NextResponse } from "next/server";
import { getArenaRankings } from "@/lib/arena";

export async function GET(request: NextRequest) {
  try { return NextResponse.json({ rankings: await getArenaRankings(request.nextUrl.searchParams.get("discipline") ?? undefined) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load rankings." }, { status: 500 }); }
}
