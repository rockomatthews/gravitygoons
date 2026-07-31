import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured || request.headers.get("authorization") !== `Bearer ${configured}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Match storage is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("advance_scheduled_matches");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...data });
}
