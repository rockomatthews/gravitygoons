import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { repairItem } from "@/lib/workshop-server";

export async function POST(request: Request) {
  try { return NextResponse.json({ item: await repairItem(await requireSessionAddress(), await request.json()) }); }
  catch (error) { const message=error instanceof Error?error.message:"Unable to repair."; return NextResponse.json({ error: message }, { status: message==="AUTH_REQUIRED"?401:400 }); }
}
