import { NextResponse } from "next/server";
import { createChallenge, listChallenges } from "@/lib/challenges";
import { requireSessionAddress } from "@/lib/request-auth";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Challenge request failed.";
  return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
}

export async function GET() {
  try { return NextResponse.json(await listChallenges(await requireSessionAddress())); } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const wallet = await requireSessionAddress();
    const body = await request.json();
    return NextResponse.json({ challenge: await createChallenge(wallet, body) }, { status: 201 });
  } catch (error) { return failure(error); }
}
