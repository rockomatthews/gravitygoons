import { isAddress } from "viem";
import { NextResponse } from "next/server";
import { getProfileForWallet } from "@/lib/profile-data";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return NextResponse.json({ error: "Valid wallet address required." }, { status: 400 });
  const profile = await getProfileForWallet(address);
  return NextResponse.json({ username: profile?.username ?? null }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
