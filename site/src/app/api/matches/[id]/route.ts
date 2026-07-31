import { NextResponse } from "next/server";
import { getMatch } from "@/lib/matches";
import { requireSessionAddress } from "@/lib/request-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, wallet] = await Promise.all([context.params, requireSessionAddress()]);
    return NextResponse.json({ match: await getMatch(wallet, id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load match.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
