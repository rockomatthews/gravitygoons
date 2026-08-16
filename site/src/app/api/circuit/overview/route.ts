import { NextResponse } from "next/server";
import { getCircuitOverview } from "@/lib/circuit/server";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet") ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("VALID_WALLET_REQUIRED");
    return NextResponse.json(await getCircuitOverview(wallet), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Circuit." }, { status: 400 }); }
}
