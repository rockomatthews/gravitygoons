import { NextResponse } from "next/server";
import { listWorkshopRecipes } from "@/lib/workshop-server";

export async function GET() {
  try { return NextResponse.json({ recipes: await listWorkshopRecipes() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load recipes." }, { status: 503 }); }
}
