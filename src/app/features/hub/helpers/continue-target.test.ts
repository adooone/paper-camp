import type { HubMachine } from '@/app/services/hub-machines';
import { describe, expect, it } from 'vitest';
import { pickContinueTarget } from './continue-target';

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

describe('pickContinueTarget', () => {
  it('is null when nothing has ever been opened', () => {
    expect(pickContinueTarget([machine({ projects: [row()] })])).toBeNull();
  });

  it('picks the most recently opened row across every machine', () => {
    const machines = [
      machine({
        machineUrl: 'a',
        projects: [row({ runtimeUrl: 'a1', slug: 'a1', lastOpenedAt: '2020-01-01' })],
      }),
      machine({
        machineUrl: 'b',
        projects: [row({ runtimeUrl: 'b1', slug: 'b1', lastOpenedAt: '2024-01-01' })],
      }),
    ];
    const target = pickContinueTarget(machines);
    expect(target?.machineUrl).toBe('b');
    expect(target?.row.slug).toBe('b1');
  });
});
