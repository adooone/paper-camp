import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import type { AgentTaskState, CiReleaseState } from '@/types/index';
import { switcherItems } from './project-items';
import { ProjectSwitcher } from './project-switcher';
import { attentionTitle, formatElapsed, newestLine, runDetail } from './projects-copy';
import { relativeDay, releaseLine, repoProgress } from './repo-status';
import { RepoStatusCard } from './repo-status-card';
import { docPath, SCREEN_PATHS, screenOf, tabOf, WIDE_QUERY } from './screens';
import { TitleRow } from './title-row';
import { VersionStamp } from './version-stamp';

const render = (element: ReactElement): string => renderToStaticMarkup(element);
const noop = () => {};

const row = (slug: string, stamp: HubProjectRow['stamp'], extra: Partial<HubProjectRow> = {}) =>
  ({
    runtimeUrl: `https://deimos/p/${slug}`,
    slug,
    packageName: null,
    stamp,
    lastOpenedAt: null,
    ...extra,
  }) as HubProjectRow;

const machine = (projects: HubProjectRow[]): HubMachine =>
  ({ machineUrl: 'https://deimos', host: 'deimos', projects }) as HubMachine;

describe('screens', () => {
  it('maps a path to its screen and every screen to a tab', () => {
    expect(screenOf('/')).toBe('projects');
    expect(screenOf('')).toBe('projects');
    expect(screenOf('/ideas')).toBe('ideas');
    expect(screenOf('/ideas/IDEA-1')).toBe('ideas');
    expect(screenOf('/log/')).toBe('log');
    expect(screenOf('/elsewhere')).toBe('projects');
    expect(tabOf('log')).toBe('projects');
    expect(tabOf('git')).toBe('projects');
    expect(screenOf('/roadmap')).toBe('roadmap');
    expect(screenOf('/stats/')).toBe('stats');
    expect(screenOf('/docs/MAIN.md')).toBe('docs');
    expect(screenOf('/diff')).toBe('diff');
    expect(tabOf('diff')).toBe('projects');
    expect(tabOf('docs')).toBe('projects');
    expect(docPath('docs/A B.md')).toBe('/docs/docs%2FA%20B.md');
    expect(screenOf('/queue')).toBe('queue');
    expect(screenOf('/night/')).toBe('night');
    expect(screenOf('/settings/desk')).toBe('settings');
    expect(tabOf('queue')).toBe('projects');
    expect(tabOf('night')).toBe('projects');
    expect(tabOf('roadmap')).toBe('projects');
    expect(tabOf('stats')).toBe('projects');
    expect(tabOf('settings')).toBe('settings');
  });

  it('keeps the island width rule at the same breakpoint as the stylesheet', () => {
    const css = readFileSync(new URL('./shell.module.css', import.meta.url), 'utf8');
    expect(WIDE_QUERY).toBe('(min-width: 1024px)');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('max-width: 720px');
    expect(SCREEN_PATHS.projects).toBe('/');
  });
});

describe('TitleRow', () => {
  it('shows the title and a labelled project switcher', () => {
    const html = render(
      <TitleRow title="Projects" projectName="paper-camp" onOpenSwitcher={noop} />,
    );
    expect(html).toMatch(/<h1[^>]*>Projects<\/h1>/);
    expect(html).toContain('aria-label="Switch project, current paper-camp"');
  });

  it('omits the switcher until the project is known', () => {
    expect(render(<TitleRow title="Projects" onOpenSwitcher={noop} />)).not.toContain(
      'Switch project',
    );
  });

  it('puts the island at the right, taking the place of the stamp', () => {
    const withIsland = render(
      <TitleRow title="Log" stamp="3 unread" onOpenSwitcher={noop} island={<nav>island</nav>} />,
    );
    expect(withIsland).toContain('<nav>island</nav>');
    expect(withIsland).not.toContain('3 unread');
    const withStamp = render(<TitleRow title="Log" stamp="3 unread" onOpenSwitcher={noop} />);
    expect(withStamp).toContain('3 unread');
  });
});

describe('switcherItems', () => {
  it('names rows by label, then package without its scope, then slug', () => {
    const items = switcherItems([
      machine([
        row('a', { kind: 'idle' }, { label: 'Camp' }),
        row('b', { kind: 'idle' }, { packageName: '@dendelion/paper-camp' }),
        row('c', { kind: 'idle' }),
      ]),
    ]);
    expect(items.map((item) => item.projectName)).toEqual(['Camp', 'paper-camp', 'c']);
    expect(items[0]).toMatchObject({ id: 'https://deimos/p/a', machineName: 'deimos' });
  });

  it('stamps only the rows that earn one', () => {
    const items = switcherItems([
      machine([
        row('run', { kind: 'running', ideaId: null }),
        row('stop', { kind: 'interrupted', count: 2 }),
        row('gone', { kind: 'missing' }),
        row('wait', { kind: 'loading' }),
        row('rest', { kind: 'idle' }),
      ]),
    ]);
    expect(items.map((item) => item.stamp)).toEqual([
      { meaning: 'running', label: 'running' },
      { meaning: 'failed', label: 'interrupted' },
      { meaning: 'failed', label: 'missing' },
      { meaning: 'parked', label: 'loading' },
      null,
    ]);
  });
});

describe('ProjectSwitcher', () => {
  const items = switcherItems([
    machine([row('idle', { kind: 'idle' }), row('busy', { kind: 'running', ideaId: null })]),
  ]);

  it('lists the running project first and ticks the current one', () => {
    const html = render(
      <ProjectSwitcher
        visible
        onRequestClose={noop}
        items={items}
        currentId="https://deimos/p/idle"
        onSelect={noop}
        onAddMachine={noop}
      />,
    );
    expect(html.indexOf('busy')).toBeLessThan(html.indexOf('idle'));
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('>✓<');
    expect(html).toContain('+ Add a machine');
    expect(html).toContain('Switch project');
  });

  it('names the one machine in the title and drops the per-row machine line', () => {
    const html = render(
      <ProjectSwitcher
        visible
        onRequestClose={noop}
        items={items}
        currentId={null}
        singleMachineName="deimos"
        onSelect={noop}
        onAddMachine={noop}
      />,
    );
    expect(html).toContain('Switch project · deimos');
    expect(html.match(/deimos/g)).toHaveLength(1);
  });

  it('says so when nothing is paired and renders nothing while closed', () => {
    const props = {
      onRequestClose: noop,
      items: [],
      currentId: null,
      onSelect: noop,
      onAddMachine: noop,
    };
    expect(render(<ProjectSwitcher visible {...props} />)).toContain('No projects paired yet.');
    expect(render(<ProjectSwitcher visible={false} {...props} />)).toBe('');
  });
});

const ci = (patch: Partial<CiReleaseState> = {}): CiReleaseState => ({
  repo: 'camp',
  branch: 'main',
  available: true,
  fetchedAt: '2026-11-20T10:00:00Z',
  runs: [
    { workflow: 'Release', status: 'success', url: 'https://ci/1' },
    { workflow: 'CI', status: 'failure', url: 'https://ci/2', failedJobs: ['lint'] },
  ],
  releasePlease: true,
  releasePr: { number: 1, title: 'chore: release 0.48.0', url: 'https://pr/1', version: '0.48.0' },
  releasedVersion: '0.47.0',
  draftPr: null,
  ...patch,
});

describe('repo status', () => {
  it('words the release line and the branch progress', () => {
    expect(releaseLine(ci())).toBe('0.47.0 · 0.48.0 queued');
    expect(releaseLine(ci({ releasePr: null, releasedVersion: null }))).toBe(
      'unreleased · nothing queued',
    );
    expect(repoProgress({ branch: 'main', changed: 11, ahead: 1, behind: 0 })).toBe(
      'main · 11 changed · ahead 1',
    );
    expect(repoProgress({ branch: 'dev', changed: 0, ahead: 0, behind: 2 })).toBe(
      'dev · clean · behind 2',
    );
  });

  it('reads commit age in coarse units', () => {
    const now = Date.parse('2026-11-20T12:00:00Z');
    expect(relativeDay('2026-11-20T11:59:40Z', now)).toBe('just now');
    expect(relativeDay('2026-11-20T11:30:00Z', now)).toBe('30m ago');
    expect(relativeDay('2026-11-20T08:00:00Z', now)).toBe('4h ago');
    expect(relativeDay('2026-11-17T12:00:00Z', now)).toBe('3d ago');
    expect(relativeDay('nope', now)).toBe('');
  });

  it('draws the card in the phone order: runs, release, branch, last commit', () => {
    const html = render(
      <RepoStatusCard
        ci={ci()}
        git={{ branch: 'main', changed: 11, ahead: 1, behind: 0 }}
        latest={{ subject: 'run bookkeeping', date: '2026-11-20T11:00:00Z' }}
      />,
    );
    const order = [
      'Release',
      'passed',
      'CI',
      'failed · lint',
      '0.47.0',
      'main · 11 changed',
      'run bookkeeping',
    ];
    const positions = order.map((text) => html.indexOf(text));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('draws nothing when neither CI nor git is known', () => {
    expect(render(<RepoStatusCard ci={null} git={null} latest={null} />)).toBe('');
  });

  it('skips the CI half when CI is unavailable', () => {
    const html = render(
      <RepoStatusCard
        ci={ci({ available: false })}
        git={{ branch: 'main', changed: 0, ahead: 0, behind: 0 }}
        latest={null}
      />,
    );
    expect(html).not.toContain('Release');
    expect(html).toContain('main · clean');
  });
});

describe('VersionStamp', () => {
  it('shows the version with a check for updates below it', () => {
    const html = render(<VersionStamp onCheck={noop} />);
    expect(html).toMatch(/>v\d+\.\d+\.\d+[^<]*<\/span>.*check for updates/);
  });
});

describe('Projects copy', () => {
  const task = (patch: Partial<AgentTaskState> = {}): AgentTaskState =>
    ({
      id: 't',
      planTitle: 'Plan',
      startedAt: '2026-11-20T10:00:00Z',
      lines: [],
      ...patch,
    }) as AgentTaskState;
  const now = Date.parse('2026-11-20T10:12:30Z');

  it('words each attention line with the right plural', () => {
    expect(attentionTitle({ kind: 'questions', count: 1 }, now)).toBe('1 question waiting');
    expect(attentionTitle({ kind: 'failed', count: 23 }, now)).toBe('23 runs failed');
    expect(attentionTitle({ kind: 'findings', count: 26 }, now)).toBe(
      'Night shift found 26 things',
    );
    expect(attentionTitle({ kind: 'findings', count: 1 }, now)).toBe('Night shift found 1 thing');
    expect(attentionTitle({ kind: 'running', count: 2, since: '2026-11-20T10:00:00Z' }, now)).toBe(
      '2 runs going · 12m',
    );
    expect(attentionTitle({ kind: 'running', count: 1 }, now)).toBe('1 run going');
  });

  it('formats elapsed time and the run detail', () => {
    expect(formatElapsed('2026-11-20T10:12:00Z', now)).toBe('30s');
    expect(formatElapsed('2026-11-20T10:00:00Z', now)).toBe('12m 30s');
    expect(formatElapsed('2026-11-20T08:00:00Z', now)).toBe('2h 12m');
    expect(formatElapsed('garbage', now)).toBe('…');
    expect(runDetail(task({ phaseIndex: 1 }), 4, now)).toBe('phase 2 of 4 · 12m 30s');
    expect(runDetail(task({ phaseIndex: 1 }), undefined, now)).toBe('phase 2 · 12m 30s');
    expect(runDetail(task(), 4, now)).toBe('12m 30s');
  });

  it('takes the newest non-blank output line', () => {
    expect(newestLine(task({ lines: ['a', ' b ', '  '] }))).toBe('b');
    expect(newestLine(task())).toBeUndefined();
  });
});
