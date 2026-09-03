import type { RuntimeConnection } from '@/app/services/runtime-connection';
import {
  fetchPackageNameAt,
  fetchRuntimeVersionAt,
  projectDisplayName,
} from '@/app/services/system';
import { CLIENT_VERSION } from '@/app/services/version';
import { canReachRuntime } from '@/core/runtime-reachability';
import { useEffect, useState } from 'react';

export interface RuntimeStatus {
  name: string | null;
  reachable: boolean;
  remoteVersion: string | null;
  versionSkew: boolean;
  schemeBlocked: boolean;
}

const UNREACHABLE: Omit<RuntimeStatus, 'schemeBlocked'> = {
  name: null,
  reachable: false,
  remoteVersion: null,
  versionSkew: false,
};

/** Asks each registered runtime what project it serves and what version it's on, in
 *  parallel. A runtime that is down, or that refuses this origin, has no response to
 *  either request — reported as unreachable (shown as plan-only) rather than the list
 *  waiting on it or a row silently vanishing. `schemeBlocked` flags the one case that
 *  needs no round trip to know: an http runtime this page's https origin refuses
 *  outright as mixed content. */
export function useRuntimeStatuses(runtimes: RuntimeConnection[]): Record<string, RuntimeStatus> {
  const [statuses, setStatuses] = useState<Record<string, RuntimeStatus>>({});
  const urls = runtimes.map((runtime) => runtime.runtimeUrl).join('\n');

  useEffect(() => {
    let cancelled = false;
    const list = urls === '' ? [] : urls.split('\n');
    Promise.all(
      list.map(async (url) => {
        const schemeBlocked = !canReachRuntime(window.location.origin, url);
        const [name, remoteVersion] = await Promise.all([
          fetchPackageNameAt(url),
          fetchRuntimeVersionAt(url),
        ]);
        const status: RuntimeStatus =
          remoteVersion === null
            ? { ...UNREACHABLE, schemeBlocked }
            : {
                name: name ? projectDisplayName(name) : null,
                reachable: true,
                remoteVersion,
                versionSkew: remoteVersion !== CLIENT_VERSION,
                schemeBlocked,
              };
        return [url, status] as const;
      }),
    ).then((resolved) => {
      if (cancelled) return;
      setStatuses(Object.fromEntries(resolved));
    });
    return () => {
      cancelled = true;
    };
  }, [urls]);

  return statuses;
}
