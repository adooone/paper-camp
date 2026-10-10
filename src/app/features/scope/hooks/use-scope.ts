import { useHubMachines } from '@/app/features/hub/hooks/use-hub-machines';
import { useProjectIdentity } from '@/app/hooks';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import { runtimeConnection } from '@/app/services/runtime-connection';
import {
  type ScopeColorToken,
  type ScopeKey,
  assignScopeColors,
  parseScopeParam,
  resolveScope,
  scopeKey,
  serializeScopeParam,
} from '@/app/services/scope';
import { openIdeasCount, unreadActivityCount } from '@/app/services/scope-counts';
import { lastScopeFor, rememberScope } from '@/app/services/scope-store';
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { resolveCurrentProject } from '../current-project';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export type ScopeCountKind = 'ideas' | 'activity' | null;

export interface ScopeRow {
  key: ScopeKey;
  runtimeUrl: string;
  slug: string;
  name: string;
  color: ScopeColorToken;
  isCurrent: boolean;
  checked: boolean;
  count: number | null;
  machineUrl: string;
  project: HubProjectRow;
}

export interface ScopeGroup {
  machineUrl: string;
  host: string;
  asleep: boolean;
  rows: ScopeRow[];
}

export interface UseScopeResult {
  groups: ScopeGroup[];
  toggle: (key: ScopeKey) => void;
  selectAll: () => void;
  clear: () => void;
  openRow: (row: ScopeRow, path?: string) => void;
}

function withSyntheticCurrent(
  machines: HubMachine[],
  currentRuntimeUrl: string,
  current: ReturnType<typeof resolveCurrentProject>,
): HubMachine[] {
  const known = machines.some((m) => m.projects.some((p) => p.runtimeUrl === currentRuntimeUrl));
  if (known) return machines;
  return [
    {
      machineUrl: current.machineUrl,
      host: current.host,
      reach: 'ready',
      runtimeVersion: null,
      versionMismatch: false,
      pendingUpdateVersion: null,
      projects: [current.project],
      mostRecentActivity: null,
    },
    ...machines,
  ];
}

export function useScope(countKind: ScopeCountKind): UseScopeResult {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useSearch({ strict: false }) as { p?: string };
  const { machines, openRow: openHubRow } = useHubMachines();
  const { projectName } = useProjectIdentity();
  const currentRuntimeUrl = runtimeConnection.runtimeUrl;

  const current = useMemo(
    () => resolveCurrentProject(machines, currentRuntimeUrl, projectName ?? 'This project'),
    [machines, currentRuntimeUrl, projectName],
  );

  const allMachines = useMemo(
    () => withSyntheticCurrent(machines, currentRuntimeUrl, current),
    [machines, currentRuntimeUrl, current],
  );

  const hubOrderKeys = useMemo(
    () => allMachines.flatMap((m) => m.projects.map((p) => scopeKey(p.slug, m.host))),
    [allMachines],
  );
  const colors = useMemo(() => assignScopeColors(hubOrderKeys), [hubOrderKeys]);

  const requested = useMemo(
    () =>
      search.p !== undefined ? parseScopeParam(search.p) : lastScopeFor(currentRuntimeUrl, storage),
    [search.p, currentRuntimeUrl],
  );
  const scope = useMemo(() => resolveScope(current.key, requested), [current.key, requested]);
  const scopeSet = useMemo(() => new Set(scope), [scope]);

  useEffect(() => {
    rememberScope(currentRuntimeUrl, scope, storage);
  }, [currentRuntimeUrl, scope]);

  const reachableUrls = useMemo(
    () =>
      allMachines
        .filter((m) => m.reach === 'ready')
        .flatMap((m) =>
          m.projects.filter((p) => p.stamp.kind !== 'missing').map((p) => p.runtimeUrl),
        ),
    [allMachines],
  );
  const urlsKey = reachableUrls.join('\n');

  const [counts, setCounts] = useState<Record<string, number | null>>({});
  useEffect(() => {
    if (!countKind) return;
    const urls = urlsKey === '' ? [] : urlsKey.split('\n');
    let cancelled = false;
    Promise.all(
      urls.map(async (url) => {
        const isCurrent = url === currentRuntimeUrl;
        const count =
          countKind === 'ideas'
            ? await openIdeasCount(url, isCurrent)
            : await unreadActivityCount(url, isCurrent);
        return [url, count] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setCounts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [urlsKey, countKind, currentRuntimeUrl]);

  const groups: ScopeGroup[] = allMachines.map((machine) => ({
    machineUrl: machine.machineUrl,
    host: machine.host,
    asleep: machine.reach === 'unreachable',
    rows: machine.projects.map((project): ScopeRow => {
      const key = scopeKey(project.slug, machine.host);
      return {
        key,
        runtimeUrl: project.runtimeUrl,
        slug: project.slug,
        name: project.packageName ?? project.label ?? project.slug,
        color: colors.get(key) ?? 'slate',
        isCurrent: project.runtimeUrl === currentRuntimeUrl,
        checked: scopeSet.has(key),
        count: counts[project.runtimeUrl] ?? null,
        machineUrl: machine.machineUrl,
        project,
      };
    }),
  }));

  function setScope(next: ScopeKey[]): void {
    navigate({
      to: pathname,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        p: next.length <= 1 ? undefined : serializeScopeParam(next),
      }),
      replace: true,
    } as never);
  }

  return {
    groups,
    toggle: (key) => {
      if (key === current.key) return;
      setScope(scopeSet.has(key) ? scope.filter((k) => k !== key) : [...scope, key]);
    },
    selectAll: () => setScope(hubOrderKeys),
    clear: () => setScope([current.key]),
    openRow: (row, path) => {
      if (row.isCurrent) return;
      rememberScope(row.runtimeUrl, scope, storage);
      openHubRow(row.project, row.machineUrl, path);
    },
  };
}
