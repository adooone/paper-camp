import type { HubMachine } from '@/app/services/hub-machines';
import { describe, expect, it } from 'vitest';
import { filterHubMachines, totalProjectCount } from './filter-machines';

function machine(overrides: Partial<HubMachine> = {}): HubMachine {
  return {
    machineUrl: 'http://host',
    host: 'host',
    reach: 'ready',
    runtimeVersion: null,
    versionMismatch: false,
    pendingUpdateVersion: null,
    projects: [],
    mostRecentActivity: null,
    ...overrides,
  };
}

function row(overrides: Partial<HubMachine['projects'][number]> = {}) {
  return {
    runtimeUrl: 'http://host/p/func-ui',
    slug: 'func-ui',
    packageName: null,
    stamp: { kind: 'idle' as const },
    lastOpenedAt: null,
    ...overrides,
  };
}

describe('totalProjectCount', () => {
  it('sums projects across every machine', () => {
    const machines = [
      machine({ projects: [row(), row({ slug: 'b' })] }),
      machine({ projects: [row({ slug: 'c' })] }),
    ];
    expect(totalProjectCount(machines)).toBe(3);
  });
});

describe('filterHubMachines', () => {
  it('returns every machine unchanged for a blank query', () => {
    const machines = [machine({ projects: [row()] })];
    expect(filterHubMachines(machines, '  ')).toBe(machines);
  });

  it('matches by slug or package name, case-insensitively', () => {
    const machines = [
      machine({
        projects: [row({ slug: 'func-ui', packageName: 'film-ui' }), row({ slug: 'other' })],
      }),
    ];
    expect(filterHubMachines(machines, 'FILM')[0].projects).toHaveLength(1);
    expect(filterHubMachines(machines, 'func')[0].projects).toHaveLength(1);
  });

  it('drops a machine with no matching project', () => {
    const machines = [machine({ projects: [row({ slug: 'func-ui' })] })];
    expect(filterHubMachines(machines, 'nope')).toHaveLength(0);
  });
});
