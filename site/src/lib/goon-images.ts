const previewIds = new Set([30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42]);

export function goonImageUrl(tokenId: number): string {
  const remote = process.env.NEXT_PUBLIC_COLLECTION_IMAGE_BASE_URL?.replace(/\/$/, "");
  if (remote) return `${remote}/${String(tokenId).padStart(4, "0")}.png`;
  if (previewIds.has(tokenId)) return `/collection/production-preview/${String(tokenId).padStart(4, "0")}.png`;
  return "/collection/base-concept.png";
}

