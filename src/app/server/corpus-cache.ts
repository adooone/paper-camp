/**
 * In-process cache for the read-only `/api/plans` and `/api/ideas` corpus reads.
 * Scoped to those two routes deliberately: other callers of readEntities/
 * readWorkEntries/readNoteEntries (agent runs, plan create/update/delete) read
 * their own recent writes back within the same request and must never see a
 * stale cache entry, so they stay uncached. `activity.ts`'s fs.watch callback
 * calls invalidate() on every papercamp/ change.
 */
const cache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;

  const promise = load().catch((error) => {
    cache.delete(key); // don't let a failed read poison the cache
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

export function invalidateCorpusCache(): void {
  cache.clear();
}
