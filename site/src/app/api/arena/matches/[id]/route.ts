import { NextResponse } from "next/server";
import { getArenaMatch } from "@/lib/arena";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getArenaMatch(id);
  return result ? NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=8" } }) : NextResponse.json({ error: "Match not found." }, { status: 404 });
}
