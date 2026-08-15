export const COLLECTION_PAGE_SIZE = 24;

export function collectionVisibleCount(page: number, connected: boolean): number {
  const normalizedPage = Math.max(1, Math.floor(page));
  const initialCount = connected ? COLLECTION_PAGE_SIZE * 3 : COLLECTION_PAGE_SIZE;
  return initialCount + (normalizedPage - 1) * COLLECTION_PAGE_SIZE;
}
