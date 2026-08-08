import { NextResponse } from "next/server";
import { getSeaportListing, syncSeaportListing } from "@/lib/seaport-listings";
import { requireSessionAddress } from "@/lib/request-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json({ listing: await getSeaportListing((await context.params).id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Listing not found." }, { status: 404 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionAddress();
    const [{ id }, body] = await Promise.all([context.params, request.json()]);
    return NextResponse.json({ listing: await syncSeaportListing(id, body.txHash) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync listing.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
