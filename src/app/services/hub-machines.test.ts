import type { MachineProjectSummary } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  type HubMachineInput,
  type RememberedProjectInput,
  buildHubMachines,
  collectMachineUrls,
  compareMachines,
  compareProjectRows,
  machineMostRecentActivity,
  parseMachineProjectRuntimeUrl,
  projectRowStamp,
} from './hub-machines';
import { CLIENT_VERSION } from './version';

function project(overrides: Partial<MachineProjectSummary> = {}): MachineProjectSummary {
  return {
    slug: 'func-ui',
    name: 'func-ui',
    mounted: true,
    busy: false,
    missing: false,
    ...overrides,
  };
}

function remembered(overrides: Partial<RememberedProjectInput> = {}): RememberedProjectInput {
  return {
    runtimeUrl: 'http://host/p/func-ui',
    lastOpenedAt: null,
    runState: { missing: false, running: false, runningIdeaId: null, interruptedCount: 0 },
    packageName: null,
    remoteVersion: null,
    reach: 'ready',
    ...overrides,
  };
}

function machine(overrides: Partial<HubMachineInput> = {}): HubMachineInput {
  return {
    machineUrl: 'http://host',
    reach: 'ready',
    runtimeVersion: CLIENT_VERSION,
    pendingUpdateVersion: null,
    reportedProjects: [],
    ...overrides,
  };
}

describe('parseMachineProjectRuntimeUrl', () => {
  it('splits a daemon-served runtime URL into machine and slug', () => {
    expect(parseMachineProjectRuntimeUrl('http://host:4333/p/func-ui')).toEqual({
      machineUrl: 'http://host:4333',
      slug: 'func-ui',
    });
  });

  it('is null for a runtime URL with no /p/ segment', () => {
    expect(parseMachineProjectRuntimeUrl('http://host:3333')).toBeNull();
  });
});

describe('collectMachineUrls', () => {
  it('unions persisted machines with ones parsed out of chosen runtime URLs', () => {
    expect(
      collectMachineUrls(['http://a'], ['http://b/p/func-ui', 'http://a/p/other', 'http://solo:9']),
    ).toEqual(['http://a', 'http://b']);
  });
});

describe('projectRowStamp', () => {
  it('is missing when the folder moved, before anything else', () => {
    expect(
      projectRowStamp({
        missing: true,
        running: true,
        runningIdeaId: 'IDEA-1',
        interruptedCount: 2,
      }),
    ).toEqual({ kind: 'missing' });
  });

  it('is running with the idea id when an agent task is in flight', () => {
    expect(
      projectRowStamp({
        missing: false,
        running: true,
        runningIdeaId: 'IDEA-42',
        interruptedCount: 0,
      }),
    ).toEqual({ kind: 'running', ideaId: 'IDEA-42' });
  });

  it('is interrupted with a count when nothing is running but a crash left one', () => {
    expect(
      projectRowStamp({ missing: false, running: false, runningIdeaId: null, interruptedCount: 3 }),
    ).toEqual({
      kind: 'interrupted',
      count: 3,
    });
  });

  it('is idle otherwise', () => {
    expect(
      projectRowStamp({ missing: false, running: false, runningIdeaId: null, interruptedCount: 0 }),
    ).toEqual({
      kind: 'idle',
    });
  });
});

describe('compareProjectRows', () => {
  const row = (stamp: 'running' | 'idle', lastOpenedAt: string | null) => ({
    runtimeUrl: lastOpenedAt ?? Math.random().toString(),
    slug: 'x',
    packageName: null,
    stamp:
      stamp === 'running'
        ? ({ kind: 'running', ideaId: null } as const)
        : ({ kind: 'idle' } as const),
    lastOpenedAt,
  });

  it('puts a running row before an idle one regardless of recency', () => {
    const running = row('running', '2020-01-01');
    const idle = row('idle', '2030-01-01');
    expect([idle, running].sort(compareProjectRows)).toEqual([running, idle]);
  });

  it('orders same-status rows by most recently opened first', () => {
    const older = row('idle', '2020-01-01');
    const newer = row('idle', '2024-01-01');
    expect([older, newer].sort(compareProjectRows)).toEqual([newer, older]);
  });

  it('sorts a never-opened row last among same-status rows', () => {
    const opened = row('idle', '2020-01-01');
    const never = row('idle', null);
    expect([never, opened].sort(compareProjectRows)).toEqual([opened, never]);
  });
});

describe('machineMostRecentActivity / compareMachines', () => {
  it("takes the latest lastOpenedAt among a machine's projects", () => {
    expect(
      machineMostRecentActivity([
        {
          runtimeUrl: 'a',
          slug: 'a',
          packageName: null,
          stamp: { kind: 'idle' },
          lastOpenedAt: '2020-01-01',
        },
        {
          runtimeUrl: 'b',
          slug: 'b',
          packageName: null,
          stamp: { kind: 'idle' },
          lastOpenedAt: '2024-01-01',
        },
      ]),
    ).toBe('2024-01-01');
  });

  it('sorts machines by most recent activity first', () => {
    const a = {
      machineUrl: 'a',
      host: 'a',
      reach: 'ready' as const,
      runtimeVersion: null,
      versionMismatch: false,
      pendingUpdateVersion: null,
      projects: [],
      mostRecentActivity: '2020-01-01',
    };
    const b = { ...a, machineUrl: 'b', host: 'b', mostRecentActivity: '2024-01-01' };
    expect([a, b].sort(compareMachines)).toEqual([b, a]);
  });
});

describe('buildHubMachines', () => {
  it('merges a chosen project into the machine that reports it, not twice', () => {
    const machines = buildHubMachines(
      [
        remembered({
          runtimeUrl: 'http://host/p/func-ui',
          label: 'My func-ui',
          lastOpenedAt: '2024-01-01',
        }),
      ],
      [machine({ reportedProjects: [project({ slug: 'func-ui', name: 'func-ui' })] })],
    );
    expect(machines).toHaveLength(1);
    expect(machines[0].projects).toHaveLength(1);
    expect(machines[0].projects[0]).toMatchObject({
      runtimeUrl: 'http://host/p/func-ui',
      slug: 'func-ui',
      label: 'My func-ui',
      lastOpenedAt: '2024-01-01',
    });
  });

  it('shows the package name only when it differs from the folder slug', () => {
    const machines = buildHubMachines(
      [],
      [machine({ reportedProjects: [project({ slug: 'func-ui', name: 'film-ui' })] })],
    );
    expect(machines[0].projects[0].packageName).toBe('film-ui');

    const same = buildHubMachines(
      [],
      [machine({ reportedProjects: [project({ slug: 'func-ui', name: 'func-ui' })] })],
    );
    expect(same[0].projects[0].packageName).toBeNull();
  });

  it("carries the chosen project's live run state over the daemon's coarse busy flag", () => {
    const machines = buildHubMachines(
      [
        remembered({
          runtimeUrl: 'http://host/p/func-ui',
          runState: { missing: false, running: true, runningIdeaId: 'IDEA-9', interruptedCount: 0 },
        }),
      ],
      [machine({ reportedProjects: [project({ slug: 'func-ui', busy: true })] })],
    );
    expect(machines[0].projects[0].stamp).toEqual({ kind: 'running', ideaId: 'IDEA-9' });
  });

  it('falls back to the daemon report when a reported project was never chosen', () => {
    const machines = buildHubMachines(
      [],
      [
        machine({
          reportedProjects: [project({ slug: 'func-ui', busy: false, interruptedCount: 2 })],
        }),
      ],
    );
    expect(machines[0].projects[0].stamp).toEqual({ kind: 'interrupted', count: 2 });
  });

  it('flags a missing project from the daemon report even if a stale chosen entry disagrees', () => {
    const machines = buildHubMachines(
      [remembered({ runtimeUrl: 'http://host/p/func-ui' })],
      [machine({ reportedProjects: [project({ slug: 'func-ui', missing: true })] })],
    );
    expect(machines[0].projects[0].stamp).toEqual({ kind: 'missing' });
  });

  it('marks a machine version mismatch once, at the machine, from the daemon runtime version', () => {
    const machines = buildHubMachines([], [machine({ runtimeVersion: '0.0.1' })]);
    expect(machines[0].versionMismatch).toBe(true);
  });

  it('groups a directly-dialled project with no machine into its own solo section', () => {
    const machines = buildHubMachines(
      [
        remembered({
          runtimeUrl: 'http://standalone:3333',
          packageName: 'standalone-app',
          remoteVersion: CLIENT_VERSION,
        }),
      ],
      [],
    );
    expect(machines).toHaveLength(1);
    expect(machines[0].machineUrl).toBe('http://standalone:3333');
    expect(machines[0].projects[0].slug).toBe('standalone-app');
  });

  it('sorts machines by most recent activity across both daemon and solo machines', () => {
    const machines = buildHubMachines(
      [
        remembered({ runtimeUrl: 'http://host/p/func-ui', lastOpenedAt: '2020-01-01' }),
        remembered({ runtimeUrl: 'http://standalone:3333', lastOpenedAt: '2024-01-01' }),
      ],
      [machine({ reportedProjects: [project({ slug: 'func-ui' })] })],
    );
    expect(machines[0].machineUrl).toBe('http://standalone:3333');
    expect(machines[1].machineUrl).toBe('http://host');
  });
});
