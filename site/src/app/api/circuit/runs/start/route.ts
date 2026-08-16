import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { startCircuitRun } from "@/lib/circuit/server";

export async function POST(request: Request) {
  try { return NextResponse.json(await startCircuitRun(await requireSessionAddress(), await request.json()), { status: 201 }); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to start Circuit."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
