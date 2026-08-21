import catalog from "../data/skate-motion-references.json" with { type: "json" };

export type MoveMotionReference = {
  discipline: string;
  trickName: string;
  sourceLabel: string;
  sourceFile?: string;
  sourceSha256?: string;
  startSeconds: number;
  durationSeconds: number;
  objectPath: string;
  motionNotes?: string;
};

const references = catalog.references as MoveMotionReference[];

export function moveMotionReferenceFor(discipline: string, trickName: string): MoveMotionReference | null {
  return references.find((reference) => reference.discipline === discipline && reference.trickName === trickName) ?? null;
}

export function allMoveMotionReferences(): readonly MoveMotionReference[] {
  return references;
}

export const MOVE_REFERENCE_SOURCE = catalog.source;
