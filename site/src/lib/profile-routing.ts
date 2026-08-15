export function numericAthleteSlug(slug: string): number | null {
  if (!/^\d+$/.test(slug)) return null;
  const tokenId = Number(slug);
  return Number.isInteger(tokenId) && tokenId >= 1 && tokenId <= 1000 ? tokenId : null;
}

export function canonicalAthletePath(tokenId: number): string {
  return `/${tokenId}`;
}
