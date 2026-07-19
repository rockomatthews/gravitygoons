export const RARITY_SIGNATURE_EDGE = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
} as const;

export type GoonRarity = keyof typeof RARITY_SIGNATURE_EDGE;

export function signatureEdgeForRarity(rarity: string): number {
  return RARITY_SIGNATURE_EDGE[rarity as GoonRarity] ?? 0;
}

export const RARITY_EDGE_DESCRIPTION =
  "Applied only when a Goon attempts its visible signature trick; base stats remain capped at 30 points.";
