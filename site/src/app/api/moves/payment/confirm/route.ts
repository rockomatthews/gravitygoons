import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { confirmMovePayment } from "@/lib/move-cinema-server";
import { readSessionAddress, SESSION_COOKIE } from "@/lib/profile-session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const address = readSessionAddress(cookieStore.get(SESSION_COOKIE)?.value);
  if (!address) return NextResponse.json({ error: "Sign in with the owner wallet first." }, { status: 401 });
  try {
    const body = await request.json() as { orderId?: string; txHash?: `0x${string}` };
    if (!body.orderId || !body.txHash || !/^0x[0-9a-fA-F]{64}$/.test(body.txHash)) return NextResponse.json({ error: "Order ID and a valid Base transaction hash are required." }, { status: 400 });
    return NextResponse.json(await confirmMovePayment(address, body.orderId, body.txHash));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm payment." }, { status: 400 });
  }
}

