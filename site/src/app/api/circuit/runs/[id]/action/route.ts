import { NextResponse } from "next/server";
import { requireSessionAddress } from "@/lib/request-auth";
import { playCircuitSector } from "@/lib/circuit/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const [{ id }, wallet, body] = await Promise.all([context.params, requireSessionAddress(), request.json()]); return NextResponse.json(await playCircuitSector(wallet, id, body)); }
  catch (error) { const message = error instanceof Error ? error.message : "Unable to resolve Circuit sector."; return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 }); }
}
