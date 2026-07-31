import { NextResponse } from "next/server";
import { getArenaMatch } from "@/lib/arena";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const result = await getArenaMatch(id);
  if (!result) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  return NextResponse.json(result.wager);
}
