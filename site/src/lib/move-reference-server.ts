import { moveMotionReferenceFor } from "@/lib/move-reference-catalog";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MOVE_REFERENCE_BUCKET = "move-reference-clips";

export async function signedMoveMotionReference(discipline: string, trickName: string): Promise<{ objectPath: string; signedUrl: string } | null> {
  const reference = moveMotionReferenceFor(discipline, trickName);
  const supabase = getSupabaseAdmin();
  if (!reference || !supabase) return null;

  const { data, error } = await supabase.storage.from(MOVE_REFERENCE_BUCKET).createSignedUrl(reference.objectPath, 20 * 60);
  if (error || !data?.signedUrl) {
    console.warn("move_reference_sign_failed", { discipline, trickName, objectPath: reference.objectPath, reason: error?.message ?? "No signed URL returned." });
    return null;
  }
  return { objectPath: reference.objectPath, signedUrl: data.signedUrl };
}
