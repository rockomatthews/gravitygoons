import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getProfileForWallet, saveProfileForWallet } from "@/lib/profile-data";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

async function sessionAddress() {
  const cookieStore = await cookies();
  return readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  const address = await sessionAddress();
  if (!address) return NextResponse.json({ authenticated: false, profile: null });
  return NextResponse.json({ authenticated: true, address, profile: await getProfileForWallet(address) });
}

export async function PUT(request: Request) {
  const address = await sessionAddress();
  if (!address) return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  try {
    const body = await request.json() as { username?: string; displayName?: string; bio?: string };
    if (!body.username || !body.displayName) return NextResponse.json({ error: "Username and display name are required." }, { status: 400 });
    const profile = await saveProfileForWallet(address, { username: body.username, displayName: body.displayName, bio: body.bio });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save profile." }, { status: 400 });
  }
}

