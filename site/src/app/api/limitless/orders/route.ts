import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Embedded Limitless order submission is locked until partner onboarding, identity controls, and jurisdiction checks are configured.",
  }, { status: 503 });
}
