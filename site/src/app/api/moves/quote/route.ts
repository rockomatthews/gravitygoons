import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createMoveQuote } from "@/lib/move-cinema-server";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with the owner wallet first." }, { status: 401 });
  try {
    const body = await request.json() as { tokenId?: number; trickId?: number };
    if (!Number.isInteger(body.tokenId) || !Number.isInteger(body.trickId)) return NextResponse.json({ error: "Token ID and trick ID are required." }, { status: 400 });
    return NextResponse.json(await createMoveQuote(address, body.tokenId!, body.trickId!));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create movie quote." }, { status: 400 });
  }
}

