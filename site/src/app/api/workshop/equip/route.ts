import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { equipItem } from "@/lib/workshop-server";

export async function POST(request: Request) {
  try { return NextResponse.json(await equipItem(await requireSessionAddress(), await request.json())); }
  catch (error) { const message=error instanceof Error?error.message:"Unable to change loadout."; return NextResponse.json({ error: message }, { status: message==="AUTH_REQUIRED"?401:400 }); }
}
