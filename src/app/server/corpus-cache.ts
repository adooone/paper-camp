// Scoped to /api/plans, /api/ideas, /api/archivable-ideas only: other callers read
// their own recent writes back within the same request and must never see stale data.
const cache = new Map<string, Promise<unknown>>();

export function cached<T>(
  key: string,
  load: () => Promise<T>,
  isCacheable: (value: T) => boolean = () => true,
): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;

  const promise = load()
    .then((value) => {
      // A result computed while PR lookup couldn't resolve (e.g. GitHub rate-limited) is a
      // guess, not a fact — never let it outlive the request that produced it.
      if (cache.get(key) === promise && !isCacheable(value)) {
        cache.delete(key);
      }
      return value;
    })
    .catch((error) => {
      // Only evict if we're still the cached entry — a delayed rejection from a
      // stale promise must not clobber a newer one populated after an invalidate.
      if (cache.get(key) === promise) {
        cache.delete(key);
      }
      throw error;
    });
  cache.set(key, promise);
  return promise;
}

export function invalidateCorpusCache(): void {
  cache.clear();
}
