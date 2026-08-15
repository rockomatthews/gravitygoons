import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { retryMoveGeneration } from "@/lib/move-cinema-server";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with the current owner wallet first." }, { status: 401 });
  try {
    const body = await request.json() as { pairId?: string };
    if (!body.pairId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.pairId)) return NextResponse.json({ error: "A valid paid movie workflow is required." }, { status: 400 });
    return NextResponse.json(await retryMoveGeneration(address, body.pairId));
  } catch (error) {
    console.error("move_generation_retry_failed", { pairId: "redacted", reason: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retry movie generation." }, { status: 400 });
  }
}
