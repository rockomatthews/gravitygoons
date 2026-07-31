import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { syncWalletOwnership } from "@/lib/profile-data";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST() {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  try {
    const tokenIds = await syncWalletOwnership(address);
    return NextResponse.json({ tokenIds, syncedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to refresh NFT ownership." }, { status: 502 });
  }
}

