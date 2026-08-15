export const PLACEMENT_MATCHES = 5;

export function athleteRankLabel(rank: number | null | undefined, matchesPlayed: number, compact = false): string {
  if (rank) return compact ? `#${rank}` : `RANK #${rank}`;
  const progress = `${Math.min(Math.max(matchesPlayed, 0), PLACEMENT_MATCHES)}/${PLACEMENT_MATCHES}`;
  return compact ? `P${progress}` : `PLACEMENT ${progress}`;
}
