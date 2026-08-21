import { moveMotionReferenceFor } from "@/lib/move-reference-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MOVE_REFERENCE_BUCKET = "move-reference-clips";
const REFERENCE_URL_TTL_SECONDS = 60 * 60;

export async function signedMoveMotionReference(discipline: string, trickName: string): Promise<{ objectPath: string; signedUrl: string } | null> {
  const reference = moveMotionReferenceFor(discipline, trickName);
  if (!reference) return null;
  if (reference.publicPath) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (!siteUrl?.startsWith("https://")) throw new Error("The required motion-reference service is not configured.");
    return { objectPath: reference.objectPath, signedUrl: `${siteUrl}${reference.publicPath}` };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("The required motion-reference service is not configured.");

  const { data, error } = await supabase.storage
    .from(MOVE_REFERENCE_BUCKET)
    .createSignedUrl(reference.objectPath, REFERENCE_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("move_reference_sign_failed", {
      discipline,
      trickName,
      objectPath: reference.objectPath,
      reason: error?.message ?? "Supabase Storage returned no signed URL.",
    });
    throw new Error("The required motion-reference video could not be prepared.");
  }
  return { objectPath: reference.objectPath, signedUrl: data.signedUrl };
}
