import { NextResponse } from "next/server";
import { createSeaportListing, listSeaportListings, SEAPORT_16_ADDRESS } from "@/lib/seaport-listings";
import { requireSessionAddress } from "@/lib/request-auth";

export async function GET(request: Request) {
  try {
    const token = Number(new URL(request.url).searchParams.get("tokenId"));
    return NextResponse.json({
      protocol: { name: "Seaport", version: "1.6", address: SEAPORT_16_ADDRESS, enabled: process.env.SEAPORT_LISTINGS_ENABLED === "true" },
      listings: await listSeaportListings(Number.isInteger(token) && token > 0 ? token : undefined),
    });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load listings." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const [wallet, body] = await Promise.all([requireSessionAddress(), request.json()]);
    return NextResponse.json({ listing: await createSeaportListing(wallet, body) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create listing.";
    return NextResponse.json({ error: message }, { status: message === "AUTH_REQUIRED" ? 401 : 400 });
  }
}
