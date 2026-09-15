import { fetchNightReportAt, fetchStatsAt } from '@/app/services/content';
import type { HubMachine } from '@/app/services/hub-machines';
import { fetchConfigAt } from '@/app/services/system';
import { DEFAULT_NIGHT_CONFIG } from '@/types/index';
import { useEffect, useState } from 'react';
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
 * The seven-day floor is read off the first reachable project — the windows are the
 * machine's, so any project on it gates on the same threshold. */
export function useHubNumbers(machines: HubMachine[], totalCount: number): HubNumbers {
  const [dataByUrl, setDataByUrl] = useState<Record<string, HubProjectData | null>>({});
  const [sevenDayFloorPct, setSevenDayFloorPct] = useState(DEFAULT_NIGHT_CONFIG.floor);
  const [loading, setLoading] = useState(false);

  const reachableUrls = reachableProjectRuntimeUrls(machines);
  const urlsKey = reachableUrls.join('\n');

  useEffect(() => {
    let cancelled = false;
    const urls = urlsKey === '' ? [] : urlsKey.split('\n');
    setLoading(urls.length > 0);
    Promise.all(urls.map(async (url) => [url, await fetchProjectData(url)] as const)).then(
      (entries) => {
        if (!cancelled) {
          setDataByUrl(Object.fromEntries(entries));
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [urlsKey]);

  const floorRuntimeUrl = reachableUrls[0] ?? null;
  useEffect(() => {
    if (!floorRuntimeUrl) {
      setSevenDayFloorPct(DEFAULT_NIGHT_CONFIG.floor);
      return;
    }
    let cancelled = false;
    fetchConfigAt(floorRuntimeUrl).then((config) => {
      if (!cancelled) setSevenDayFloorPct(config?.night?.floor ?? DEFAULT_NIGHT_CONFIG.floor);
    });
    return () => {
      cancelled = true;
    };
  }, [floorRuntimeUrl]);

  return { ...sumHubNumbers({ totalCount, dataByUrl, sevenDayFloorPct }), loading };
}
