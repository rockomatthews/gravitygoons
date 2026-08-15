import { NextResponse } from "next/server";
import { getGoonCareer } from "@/lib/gooniverse-server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ tokenId: string }> }) {
  try {
    const { tokenId } = await context.params;
    return NextResponse.json(await getGoonCareer(Number(tokenId)), { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load this Goon career." }, { status: 400 });
  }
}
