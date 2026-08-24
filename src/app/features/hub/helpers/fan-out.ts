import type { RuntimeConnection } from '@/app/services/runtime-connection';

export interface ProjectContribution<T> {
  runtime: RuntimeConnection;
  data: T;
}

/** Asks every registered runtime in parallel and composes what answers — an
 *  unreachable one (`fetchOne` resolving null) simply contributes nothing to
 *  the merged view, rather than the whole view waiting on or erroring for it. */
export async function fanOutRuntimes<T>(
  runtimes: RuntimeConnection[],
  fetchOne: (runtimeUrl: string) => Promise<T | null>,
): Promise<ProjectContribution<T>[]> {
  const results = await Promise.all(
    runtimes.map(async (runtime): Promise<ProjectContribution<T> | null> => {
      const data = await fetchOne(runtime.runtimeUrl);
      if (data === null) return null;
      return { runtime, data };
    }),
  );
  return results.filter((r): r is ProjectContribution<T> => r !== null);
}
