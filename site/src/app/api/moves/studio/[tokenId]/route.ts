import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStudioMoves } from "@/lib/profile-data";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function GET(_request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with the owner wallet first." }, { status: 401 });
  try {
    const { tokenId: raw } = await params;
    return NextResponse.json(await getStudioMoves(address, Number(raw)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load move studio." }, { status: 403 });
  }
}

