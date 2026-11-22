import { describe, expect, it } from 'vitest';
import type { BatchRunState } from '@/core/batch-run';
import type { AgentTaskState, CiReleaseState, TaskLogEntry } from '@/types/index';
import { SCREEN_PATHS } from './screens';
import {
  ciView,
  deskChangeLines,
  noticeTarget,
  queueCardView,
  showQueueCard,
  taskCardView,
  taskTarget,
} from './stack-model';

const task = (extra: Partial<AgentTaskState> = {}): AgentTaskState => ({
  id: 'r1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'Make it sing',
  planId: 'IDEA-7',
  startedAt: '2026-11-02T10:00:00.000Z',
  agentId: 'claude-code',
  lines: [],
  ...extra,
});

const batch = (extra: Partial<BatchRunState> = {}): BatchRunState =>
  ({
    status: 'running',
    initialIds: ['IDEA-1', 'IDEA-2', 'IDEA-3'],
    ideasRun: 1,
    items: [
      { id: 'IDEA-1', outcome: 'done' },
      { id: 'IDEA-2', outcome: 'running' },
      { id: 'IDEA-3', outcome: 'queued' },
    ],
    ...extra,
  }) as BatchRunState;

describe('taskCardView', () => {
  it('stamps a live run as running and lets it be stopped', () => {
    const view = taskCardView(task(), 'Phase 1: IDEA-7');
    expect(view).toMatchObject({
      title: 'Phase 1: IDEA-7',
      stamp: { meaning: 'running', label: 'running' },
      live: true,
      stopping: false,
      signedOut: false,
    });
  });

  it('disables a stopping run and keeps a finished one off the stop path', () => {
    expect(taskCardView(task({ status: 'stopping' }), 't').stopping).toBe(true);
    expect(taskCardView(task({ status: 'done' }), 't')).toMatchObject({
      live: false,
      stamp: { meaning: 'done' },
    });
  });

  it('turns a signed-out failure into a way back to settings', () => {
    expect(taskCardView(task({ status: 'error', errorKind: 'auth' }), 't')).toMatchObject({
      signedOut: true,
      stamp: { meaning: 'failed', label: 'stopped — agent signed out' },
    });
    expect(taskCardView(task({ status: 'error' }), 't').signedOut).toBe(false);
  });
});

describe('where a card opens', () => {
  it('sends chat to chat and any other run to its log entry', () => {
    expect(taskTarget(task({ taskKind: 'chat' }))).toBe(SCREEN_PATHS.chat);
    expect(taskTarget(task({ id: 'p1' }))).toMatch(new RegExp(`^${SCREEN_PATHS.log}/`));
    expect(noticeTarget({ id: 'x:1' } as TaskLogEntry)).toBe(
      `${SCREEN_PATHS.log}/${encodeURIComponent('task:x:1')}`,
    );
  });
});

describe('queueCardView', () => {
  it('counts finished items and names the running idea', () => {
    expect(queueCardView(batch(), 'editing files', 'Claude')).toMatchObject({
      title: 'Run queue — 1/3',
      line: 'IDEA-2 — editing files',
      stamp: { meaning: 'running', label: 'running' },
      canStop: true,
      canDismiss: false,
    });
  });

  it('names the pause reason and offers nothing to stop', () => {
    const paused = batch({ status: 'paused', pause: { kind: 'red-checks' } } as never);
    expect(queueCardView(paused, undefined, 'Claude')).toMatchObject({
      stamp: { meaning: 'failed', label: 'checks red' },
      canStop: false,
    });
  });

  it('turns a finished queue into a dismissable report', () => {
    const done = batch({ status: 'done', ideasRun: 3 });
    expect(queueCardView(done, undefined, 'Claude')).toMatchObject({
      line: '3 idea(s) run',
      canStop: false,
      canDismiss: true,
    });
    expect(showQueueCard(done, true)).toBe(false);
    expect(showQueueCard(done, false)).toBe(true);
    expect(showQueueCard(null, false)).toBe(false);
  });
});

describe('ciView', () => {
  const ci = (extra: Partial<CiReleaseState> = {}): CiReleaseState =>
    ({
      available: true,
      branch: 'main',
      runs: [
        { workflow: 'ci', status: 'success', url: 'https://gh/1' },
        { workflow: 'release', status: 'failure', url: null, failedJobs: ['build'] },
      ],
      releasedVersion: '1.2.0',
      releasePlease: false,
      releasePr: null,
      draftPr: null,
      fetchedAt: '2026-11-02T10:00:00.000Z',
      ...extra,
    }) as CiReleaseState;

  it('says nothing is declared or reachable before listing runs', () => {
    expect(ciView(null)).toEqual({ kind: 'none' });
    expect(ciView(ci({ available: false }))).toEqual({ kind: 'unavailable' });
  });

  it('lists runs with their tone and failed jobs', () => {
    const view = ciView(ci());
    expect(view).toMatchObject({ kind: 'ready', version: '1.2.0', runsUnreadable: false });
    if (view.kind !== 'ready') return;
    expect(view.lines.map((line) => [line.name, line.tone, line.tooltip])).toEqual([
      ['ci', 'pass', undefined],
      ['release', 'fail', 'build'],
    ]);
  });

  it('points a draft PR with missing secrets at settings', () => {
    const view = ciView(
      ci({
        draftPr: { scoutAppId: false, scoutPrivateKey: true, secretsChecked: true, lastRun: null },
      }),
    );
    if (view.kind !== 'ready') throw new Error('expected a ready view');
    expect(view.lines.at(-1)).toMatchObject({
      name: 'Draft PR',
      word: 'secrets missing',
      opensSettings: true,
    });
  });
});

describe('deskChangeLines', () => {
  it('marks each proposed change with what it does to the desk', () => {
    const lines = deskChangeLines({
      services: [
        { kind: 'added', service: { name: 'web', cmd: 'pnpm dev' } },
        {
          kind: 'changed',
          before: { name: 'api', cmd: 'old' },
          after: { name: 'api', cmd: 'new' },
        },
      ],
      checks: [{ kind: 'removed', check: { name: 'lint', cmd: 'pnpm lint' } }],
      ci: { kind: 'added', ci: { repo: 'o/r' } },
    });
    expect(lines.map((line) => `${line.mark} ${line.area} ${line.text}`)).toEqual([
      '+ service web — pnpm dev',
      '~ service api — new',
      '− check lint — pnpm lint',
      '+ ci o/r',
    ]);
  });
});
