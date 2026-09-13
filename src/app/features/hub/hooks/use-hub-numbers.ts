import { fetchNightReportAt, fetchStatsAt } from '@/app/services/content';
import type { HubMachine } from '@/app/services/hub-machines';
import { fetchConfigAt } from '@/app/services/system';
import { DEFAULT_NIGHT_CONFIG } from '@/types/index';
import { useEffect, useState } from 'react';
import type { ContinueTarget } from '../helpers/continue-target';
import {
  type HubNumbers,
  type HubProjectData,
  reachableProjectRuntimeUrls,
  sumHubNumbers,
} from '../helpers/hub-numbers';

async function fetchProjectData(runtimeUrl: string): Promise<HubProjectData | null> {
  const [stats, nightGroups] = await Promise.all([
    fetchStatsAt(runtimeUrl),
    fetchNightReportAt(runtimeUrl),
  ]);
  return stats ? { stats, nightGroups: nightGroups ?? [] } : null;
}

/** Reads `/api/stats` (and last night's findings) off every reachable project once
 * per set of reachable machines, and sums them into the right column's six figures.
 * The seven-day floor comes from the Continue project's own night config, so the
 * gauge marks the threshold that project actually gates on. */
export function useHubNumbers(
  machines: HubMachine[],
  totalCount: number,
  continueTarget: ContinueTarget | null,
): HubNumbers {
  const [dataByUrl, setDataByUrl] = useState<Record<string, HubProjectData | null>>({});
  const [continueFloorPct, setContinueFloorPct] = useState(DEFAULT_NIGHT_CONFIG.floor);

  const reachableUrls = reachableProjectRuntimeUrls(machines);
  const urlsKey = reachableUrls.join('\n');

  useEffect(() => {
    let cancelled = false;
    const urls = urlsKey === '' ? [] : urlsKey.split('\n');
    Promise.all(urls.map(async (url) => [url, await fetchProjectData(url)] as const)).then(
      (entries) => {
        if (!cancelled) setDataByUrl(Object.fromEntries(entries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [urlsKey]);

  const continueRuntimeUrl = continueTarget?.row.runtimeUrl ?? null;
  useEffect(() => {
    if (!continueRuntimeUrl) {
      setContinueFloorPct(DEFAULT_NIGHT_CONFIG.floor);
      return;
    }
    let cancelled = false;
    fetchConfigAt(continueRuntimeUrl).then((config) => {
      if (!cancelled) setContinueFloorPct(config?.night?.floor ?? DEFAULT_NIGHT_CONFIG.floor);
    });
    return () => {
      cancelled = true;
    };
  }, [continueRuntimeUrl]);

  return sumHubNumbers({ totalCount, dataByUrl, continueRuntimeUrl, continueFloorPct });
}
