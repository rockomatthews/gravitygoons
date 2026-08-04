import { isAddress } from "viem";
import { NextRequest, NextResponse } from "next/server";
import { readWalletOwnership } from "@/lib/profile-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet")?.toLowerCase() ?? "";
  if (!isAddress(wallet)) return NextResponse.json({ error: "A valid wallet is required." }, { status: 400 });

  try {
    const tokenIds = await readWalletOwnership(wallet);
    return NextResponse.json(
      { wallet, tokenIds, verifiedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Base ownership verification failed." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
