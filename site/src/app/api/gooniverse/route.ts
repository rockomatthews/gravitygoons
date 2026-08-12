import { NextResponse } from "next/server";
import { getGooniverseOverview } from "@/lib/gooniverse-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getGooniverseOverview(), { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the Gooniverse." }, { status: 503 });
  }
}
