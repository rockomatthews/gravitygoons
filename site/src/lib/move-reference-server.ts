import { moveMotionReferenceFor } from "@/lib/move-reference-catalog";
import { createMoveReferenceAccessUrl } from "@/lib/move-reference-access";

export const MOVE_REFERENCE_BUCKET = "move-reference-clips";

export async function signedMoveMotionReference(discipline: string, trickName: string): Promise<{ objectPath: string; signedUrl: string } | null> {
  const reference = moveMotionReferenceFor(discipline, trickName);
  if (!reference) return null;
  const signedUrl = createMoveReferenceAccessUrl(reference.objectPath);
  if (!signedUrl) {
    console.warn("move_reference_sign_failed", { discipline, trickName, objectPath: reference.objectPath, reason: "Reference access URL is not configured." });
    return null;
  }
  return { objectPath: reference.objectPath, signedUrl };
}
