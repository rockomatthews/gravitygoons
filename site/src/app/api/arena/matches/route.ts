import { NextRequest, NextResponse } from "next/server";
import { listArenaMatches } from "@/lib/arena";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const discipline = request.nextUrl.searchParams.get("discipline") ?? undefined;
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    return NextResponse.json(await listArenaMatches({ status, discipline, cursor }), { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the arena." }, { status: 500 });
  }
}
