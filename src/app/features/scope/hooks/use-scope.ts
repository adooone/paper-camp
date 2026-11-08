import { useHubMachines } from '@/app/features/hub/hooks/use-hub-machines';
import { useProjectIdentity } from '@/app/hooks';
import { fetchChat, fetchChatAt } from '@/app/services/content/chat-api';
import { fetchWorklist, fetchWorklistAt } from '@/app/services/content/entities-api';
import { fetchNotifications, fetchNotificationsAt } from '@/app/services/content/notifications-api';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import { chatQueryKey, notificationsQueryKey, worklistQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import {
  type ScopeKey,
  parseScopeParam,
  resolveScope,
  scopeKey,
  serializeScopeParam,
} from '@/app/services/scope';
import {
  openIdeasCount,
  unansweredChatCount,
  unreadActivityCount,
} from '@/app/services/scope-counts';
import { lastScopeFor, rememberScope } from '@/app/services/scope-store';
import { useQueries } from '@tanstack/react-query';
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { resolveCurrentProject } from '../current-project';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export type ScopeCountKind = 'ideas' | 'activity' | 'chat' | null;

function useScopeCounts(
  urls: string[],
  countKind: ScopeCountKind,
  currentRuntimeUrl: string,
): { counts: Record<string, number | null>; pending: Set<string> } {
  const active = countKind === null ? [] : urls;
  const queries = useQueries({
    queries: active.map((url) => {
      const isCurrent = url === currentRuntimeUrl;
      if (countKind === 'ideas') {
        return {
          queryKey: worklistQueryKey(url),
          queryFn: () => (isCurrent ? fetchWorklist() : fetchWorklistAt(url)),
          select: openIdeasCount,
        };
      }
      if (countKind === 'chat') {
        return {
          queryKey: chatQueryKey(url),
          queryFn: () => (isCurrent ? fetchChat() : fetchChatAt(url)),
          select: unansweredChatCount,
        };
      }
      return {
        queryKey: notificationsQueryKey(url),
        queryFn: () => (isCurrent ? fetchNotifications() : fetchNotificationsAt(url)),
        select: unreadActivityCount,
      };
    }),
  });
  const counts: Record<string, number | null> = {};
  const pending = new Set<string>();
  active.forEach((url, index) => {
    const query = queries[index];
    counts[url] = (query?.data as number | null | undefined) ?? null;
    if (query?.isPending) pending.add(url);
  });
  return { counts, pending };
}

export interface ScopeRow {
  key: ScopeKey;
  runtimeUrl: string;
  slug: string;
  name: string;
  isCurrent: boolean;
  checked: boolean;
  count: number | null;
  countLoading: boolean;
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
  const { runtimeUrl: currentRuntimeUrl } = useRuntimeConnection();

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

  const { counts, pending } = useScopeCounts(reachableUrls, countKind, currentRuntimeUrl);

  // Alphabetical, not the hub's recency order, so switching project never reshuffles the list.
  const groups: ScopeGroup[] = [...allMachines]
    .sort((a, b) => a.host.localeCompare(b.host))
    .map((machine) => ({
      machineUrl: machine.machineUrl,
      host: machine.host,
      asleep: machine.reach === 'unreachable',
      rows: machine.projects
        .map((project): ScopeRow => {
          const key = scopeKey(project.slug, machine.host);
          return {
            key,
            runtimeUrl: project.runtimeUrl,
            slug: project.slug,
            name: project.packageName ?? project.label ?? project.slug,
            isCurrent: project.runtimeUrl === currentRuntimeUrl,
            checked: scopeSet.has(key),
            count: counts[project.runtimeUrl] ?? null,
            countLoading: countKind !== null && pending.has(project.runtimeUrl),
            machineUrl: machine.machineUrl,
            project,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

  function setScope(next: ScopeKey[]): void {
    navigate({
      to: pathname,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        p: serializeScopeParam(next),
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
