import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Scoped to /api/plans, /api/ideas, /api/archivable-ideas only: other callers read
// their own recent writes back within the same request and must never see stale data.
interface Entry {
  promise: Promise<unknown>;
  fingerprint: string | null;
}

const cache = new Map<string, Entry>();

async function fileStamp(path: string): Promise<string> {
  try {
    const s = await stat(path);
    return `${path}:${s.mtimeMs}:${s.size}`;
  } catch {
    return `${path}:-`;
  }
}

// Hand edits, terminal agents and git never call notifyChanged, so a cached read is
// trusted only while the ideas files it came from are the same set at the same mtimes.
export async function corpusFingerprint(ideasDir: string): Promise<string> {
  const stamps: string[] = [];
  for (const dir of [ideasDir, join(ideasDir, 'archive')]) {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      stamps.push(`${dir}:-`);
      continue;
    }
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
    stamps.push(...(await Promise.all(mdFiles.map((f) => fileStamp(join(dir, f))))));
  }
  stamps.push(await fileStamp(join(ideasDir, '..', 'run-order.md')));
  return stamps.join('\n');
}

export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  isCacheable: (value: T) => boolean = () => true,
  fingerprint: (() => Promise<string>) | null = null,
): Promise<T> {
  const hit = cache.get(key);
  const current = fingerprint ? await fingerprint() : null;
  if (hit && hit.fingerprint === current) return hit.promise as Promise<T>;

  const entry: Entry = {
    fingerprint: current,
    promise: load()
      .then((value) => {
        // A result computed while PR lookup couldn't resolve (e.g. GitHub rate-limited) is a
        // guess, not a fact — never let it outlive the request that produced it.
        if (cache.get(key) === entry && !isCacheable(value)) {
          cache.delete(key);
        }
        return value;
      })
      .catch((error) => {
        // Only evict if we're still the cached entry — a delayed rejection from a
        // stale promise must not clobber a newer one populated after an invalidate.
        if (cache.get(key) === entry) {
          cache.delete(key);
        }
        throw error;
      }),
  };
  cache.set(key, entry);
  return entry.promise as Promise<T>;
}

export function invalidateCorpusCache(): void {
  cache.clear();
}
