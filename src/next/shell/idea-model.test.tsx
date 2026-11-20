import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AgentTaskState, EntityDetailEntry, ThreadMessage } from '@/types/index';
import type { IdeaScreenState } from '../hooks/use-idea-screen';
import { IdeaView } from '../idea/idea-view';
import {
  ALLOWED_TRANSITIONS,
  bodyPreview,
  formatProgress,
  ideaStatusMeaning,
  runLabel,
  tailOf,
  taskDoing,
  threadStampLine,
} from './idea-model';

const noop = () => {};

const idea = (extra: Partial<EntityDetailEntry> = {}): EntityDetailEntry => ({
  id: 'IDEA-7',
  title: 'Make it sing',
  type: 'feat',
  status: 'in-progress',
  created: '2026-11-01',
  tags: [],
  needs: [],
  body: 'A body.',
  phases: [
    { done: true, text: 'First' },
    { done: false, text: 'Second' },
  ],
  thread: [{ kind: 'chat', date: '2026-11-02', from: 'agent', text: 'Hello there' }],
  ...extra,
});

const screen = (
  entity: EntityDetailEntry,
  extra: Partial<IdeaScreenState> = {},
): IdeaScreenState => ({
  load: 'ready',
  idea: entity,
  placeholder: false,
  tasks: { running: null, ended: null },
  activeIndex: null,
  liveKind: null,
  tail: [],
  walk: null,
  error: null,
  busy: null,
  transitionBusy: null,
  locked: false,
  runNext: noop,
  runAll: noop,
  draft: noop,
  stop: noop,
  transition: noop,
  ...extra,
});

const render = (state: IdeaScreenState, onBack?: () => void) =>
  renderToStaticMarkup(<IdeaView screen={state} onBack={onBack} onDiscuss={noop} />);

const running = (extra: Partial<AgentTaskState>): AgentTaskState =>
  ({ id: 't', status: 'running', taskKind: 'phase', lines: [], ...extra }) as AgentTaskState;

describe('idea copy', () => {
  it('words progress with a percentage, and a dash without phases', () => {
    expect(formatProgress(1, 4)).toBe('1 / 4  (25%)');
    expect(formatProgress(0, 0)).toBe('—');
  });

  it('previews long bodies and expands them whole', () => {
    const long = 'x'.repeat(250);
    expect(bodyPreview(long, false)).toBe(`${'x'.repeat(200)}…`);
    expect(bodyPreview(long, true)).toBe(long);
    expect(bodyPreview('  short ', false)).toBe('short');
  });

  it('stamps a thread line with date, author, kind and open state', () => {
    const message: ThreadMessage = {
      kind: 'question',
      date: '2026-11-02',
      from: 'agent',
      state: 'open',
      text: 'Which?',
    };
    expect(threadStampLine(message)).toBe('2026-11-02 · agent · question · open');
    expect(threadStampLine({ kind: 'chat', text: 'Hi' })).toBe('you');
  });

  it('keeps the last four non-empty output lines', () => {
    const lines = ['a', '', ' b ', 'c', 'd', 'e'];
    expect(tailOf(running({ lines }))).toEqual(['b', 'c', 'd', 'e']);
    expect(tailOf(null)).toEqual([]);
  });

  it('labels what a run is doing', () => {
    expect(taskDoing('draft')).toBe('Drafting the plan');
    expect(taskDoing('sync')).toBe('Working');
    expect(runLabel({ index: 1 }, 3, null)).toBe('Running 2 of 3…');
    expect(runLabel(null, 3, running({ phaseIndex: 0 }))).toBe('Running phase 1…');
    expect(runLabel(null, 3, running({ taskKind: 'extend' }))).toBe('Extending the idea…');
  });

  it('allows the phone transitions and stamps review as idle', () => {
    expect(ALLOWED_TRANSITIONS.review).toEqual(['in-progress', 'done', 'dropped']);
    expect(ALLOWED_TRANSITIONS.done).toEqual([]);
    expect(ideaStatusMeaning('review')).toBe('idle');
    expect(ideaStatusMeaning('in-progress')).toBe('running');
  });
});

describe('IdeaView', () => {
  it('lays the cards out in the phone order', () => {
    const html = render(screen(idea()));
    const order = [
      'IDEA-7',
      'Make it sing',
      'Phases',
      'Description',
      'Status',
      'Thread',
      'Run next',
    ];
    const at = order.map((text) => html.indexOf(text));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('1 / 2  (50%)');
    expect(html).toContain('2. Second');
    expect(html).toContain('Discuss in chat');
    expect(html).toContain('Run all');
  });

  it('shows the live phase with a running stamp and a Stop action', () => {
    const task = running({ phaseIndex: 1, lines: ['compiling'] });
    const html = render(
      screen(idea(), {
        tasks: { running: task, ended: null },
        activeIndex: 1,
        tail: ['compiling'],
        walk: { index: 1 },
        locked: true,
      }),
    );
    expect(html).toContain('Working on phase 2: Second');
    expect(html).toContain('compiling');
    expect(html).toContain('Running 2 of 2…');
    expect(html).toContain('>Stop<');
    expect(html).not.toContain('Run next');
  });

  it('offers Draft plan for an idea with no phases and nothing for a finished plan', () => {
    expect(render(screen(idea({ phases: [] })))).toContain('Draft plan');
    expect(render(screen(idea({ phases: [] })))).toContain('No phases yet.');
    const finished = render(
      screen(idea({ status: 'done', phases: [{ done: true, text: 'Only' }] })),
    );
    expect(finished).not.toContain('Run next');
    expect(finished).toContain('Nothing to transition to from done.');
  });

  it('hides phases and actions while only the worklist row is known', () => {
    const html = render(screen(idea({ phases: [], body: '' }), { placeholder: true }));
    expect(html).not.toContain('Phases');
    expect(html).not.toContain('Draft plan');
  });

  it('shows the back button and status stamp only when asked, and surfaces an error', () => {
    expect(render(screen(idea()), noop)).toContain('← Back');
    expect(render(screen(idea()))).not.toContain('← Back');
    expect(render(screen(idea(), { error: 'Run all stopped on a failed phase.' }))).toContain(
      'Run all stopped on a failed phase.',
    );
  });

  it('says so in the thread and body when they are empty', () => {
    const html = render(screen(idea({ thread: [], body: '  ' })));
    expect(html).toContain('Nothing in the thread yet.');
    expect(html).toContain('No body.');
  });
});
