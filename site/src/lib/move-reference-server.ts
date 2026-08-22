import { moveMotionReferenceFor } from "@/lib/move-reference-catalog";
import { ensureMoveReferenceStored, type ReferenceBucket } from "@/lib/move-reference-storage";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MOVE_REFERENCE_BUCKET = "move-reference-clips";
const REFERENCE_URL_TTL_SECONDS = 60 * 60;

export async function signedMoveMotionReference(discipline: string, trickName: string): Promise<{ objectPath: string; signedUrl: string } | null> {
  const reference = moveMotionReferenceFor(discipline, trickName);
  if (!reference) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("The required motion-reference service is not configured.");

  const bucket = supabase.storage.from(MOVE_REFERENCE_BUCKET);
  try {
    const storageState = await ensureMoveReferenceStored(
      bucket as unknown as ReferenceBucket,
      reference,
      process.env.NEXT_PUBLIC_SITE_URL ?? null,
    );
    console.log("move_reference_storage_ready", {
      discipline,
      trickName,
      objectPath: reference.objectPath,
      storageState,
    });
  } catch (error) {
    console.error("move_reference_storage_failed", {
      discipline,
      trickName,
      objectPath: reference.objectPath,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw new Error("The required motion-reference video could not be prepared.");
  }

  const { data, error } = await bucket
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
