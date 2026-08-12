import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { craftItem } from "@/lib/workshop-server";

export async function POST(request: Request) {
  try { return NextResponse.json({ item: await craftItem(await requireSessionAddress(), await request.json()) }, { status: 201 }); }
  catch (error) { const message=error instanceof Error?error.message:"Unable to craft."; return NextResponse.json({ error: message }, { status: message==="AUTH_REQUIRED"?401:400 }); }
}
