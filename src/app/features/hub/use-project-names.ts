import type { RuntimeConnection } from '@/app/services/runtime-connection';
import { fetchPackageNameAt, projectDisplayName } from '@/app/services/system';
import { useEffect, useState } from 'react';

/** Asks each registered runtime what project it serves. A runtime that is down, or
 *  that refuses this origin, simply has no name — the row falls back to its address
 *  rather than the list waiting on it. */
export function useProjectNames(runtimes: RuntimeConnection[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const urls = runtimes.map((runtime) => runtime.runtimeUrl).join('\n');

  useEffect(() => {
    let cancelled = false;
    const list = urls === '' ? [] : urls.split('\n');
    Promise.all(list.map(async (url) => [url, await fetchPackageNameAt(url)] as const)).then(
      (resolved) => {
        if (cancelled) return;
        setNames(
          Object.fromEntries(
            resolved
              .filter((entry): entry is readonly [string, string] => entry[1] !== null)
              .map(([url, name]) => [url, projectDisplayName(name)]),
          ),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [urls]);

  return names;
}
