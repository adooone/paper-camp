import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '@/types/index';
import { ChatView } from '../chat/chat-view';
import type { ChatScreenState } from '../hooks/use-chat-screen';
import {
  bubbleStamp,
  chatItems,
  messageTime,
  newestUserMessageId,
  newOutboxEntry,
  parseCommand,
  pendingQuestion,
  permissionPrompt,
  placeholderFor,
} from './chat-model';

const noop = () => {};

const thread: ThreadMessage[] = [
  { kind: 'chat', from: 'user', date: '2026-11-02T09:15', text: 'What is running?' },
  { kind: 'chat', from: 'agent', date: '2026-11-02T09:16', text: 'Nothing right now.' },
  { kind: 'log', date: '2026-11-02T09:17', text: 'not chat' },
  {
    kind: 'question',
    from: 'agent',
    date: '2026-11-02T09:18',
    state: 'open',
    entityId: 'IDEA-7',
    text: 'Which colour?',
    options: [{ label: 'Green', consequence: 'Matches the brand' }],
  },
  { kind: 'decision', from: 'agent', date: '2026-11-02T09:18', text: 'Going green.' },
];

const screen = (extra: Partial<ChatScreenState> = {}): ChatScreenState => ({
  load: 'ready',
  projectName: 'paper-camp',
  items: chatItems(thread),
  outbox: [],
  turn: null,
  permission: null,
  newestUserId: null,
  delivery: null,
  draft: '',
  placeholder: 'Chat with Scout',
  sending: false,
  error: null,
  notice: null,
  walk: null,
  walkTotal: 0,
  walkMessage: null,
  setDraft: noop,
  send: noop,
  retryTurn: noop,
  retryOutbox: noop,
  choose: noop,
  openIdea: noop,
  stopWalk: noop,
  reload: noop,
  ...extra,
});

describe('chat model', () => {
  it('keeps only chat-relevant messages and gives each a stable id', () => {
    const items = chatItems(thread);
    expect(items.map((item) => item.message.kind)).toEqual([
      'chat',
      'chat',
      'question',
      'decision',
    ]);
    expect(items[2]?.id).toBe('chat:2026-11-02T09:18:0');
    expect(items[3]?.id).toBe('chat:2026-11-02T09:18:1');
  });

  it('finds the newest user message and the open question', () => {
    const items = chatItems(thread);
    expect(newestUserMessageId(items)).toBe('chat:2026-11-02T09:15:0');
    expect(pendingQuestion(items)?.text).toBe('Which colour?');
    expect(placeholderFor(pendingQuestion(items))).toBe("Answer Scout's question…");
    expect(placeholderFor(null)).toBe('Chat with Scout');
  });

  it('ignores a resolved question', () => {
    const items = chatItems([{ kind: 'question', state: 'resolved', text: 'Done?' }]);
    expect(pendingQuestion(items)).toBeNull();
  });

  it('stamps each bubble by who wrote it and what it is', () => {
    expect(bubbleStamp(thread[0] as ThreadMessage)).toEqual({ meaning: 'done', label: 'you' });
    expect(bubbleStamp(thread[1] as ThreadMessage)).toEqual({ meaning: 'parked', label: 'agent' });
    expect(bubbleStamp(thread[4] as ThreadMessage).label).toBe('decision');
  });

  it('shows the clock time of a dated message', () => {
    expect(messageTime('2026-11-02T09:15')).toBe('09:15');
    expect(messageTime('2026-11-02')).toBe('2026-11-02');
    expect(messageTime(undefined)).toBe('');
  });

  it('words the allow prompt from the target, falling back to the tool', () => {
    expect(permissionPrompt({ tool: 'Bash', target: 'git status' })).toBe('Run `git status`?');
    expect(permissionPrompt({ tool: 'Bash' })).toBe('Run `Bash`?');
  });

  it('parses the run commands', () => {
    expect(parseCommand('/next idea-7')).toEqual({ command: 'next', ideaId: 'IDEA-7' });
    expect(parseCommand('/all IDEA-12')).toEqual({ command: 'all', ideaId: 'IDEA-12' });
    expect(parseCommand('/next')).toEqual({ command: 'next', ideaId: undefined });
    expect(parseCommand('hello /next IDEA-1')).toBeNull();
  });

  it('starts an outbox entry as sending', () => {
    const entry = newOutboxEntry('hi', new Date('2026-11-02T09:15:30Z'));
    expect(entry).toMatchObject({ text: 'hi', status: 'sending', date: '2026-11-02T09:15' });
  });
});

describe('ChatView', () => {
  it('renders bubbles, the question card and the composer in order', () => {
    const html = renderToStaticMarkup(<ChatView screen={screen()} />);
    const order = [
      'What is running?',
      'Nothing right now.',
      'Scout has a question',
      'Going green.',
    ];
    const positions = order.map((text) => html.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain('>you<');
    expect(html).toContain('>agent<');
    expect(html).toContain('Green — Matches the brand');
    expect(html).toContain('aria-label="Answer about IDEA-7"');
    expect(html).toContain('aria-label="Chat composer"');
    expect(html).toContain('placeholder="Chat with Scout"');
    expect(html).toContain('>Send<');
  });

  it('shows the delivery state under the newest user message', () => {
    const items = chatItems(thread);
    const html = renderToStaticMarkup(
      <ChatView screen={screen({ newestUserId: items[0]?.id ?? null, delivery: 'failed' })} />,
    );
    expect(html).toContain('Failed to send — tap to retry');
  });

  it('shows the streamed reply with its stage and the last tool lines', () => {
    const html = renderToStaticMarkup(
      <ChatView
        screen={screen({
          turn: {
            live: true,
            stage: 'replying',
            text: 'Looking at the log',
            tools: ['Read a.ts', 'Bash ls'],
            elapsedSeconds: 2,
          },
        })}
      />,
    );
    expect(html).toContain('Scout is replying…');
    expect(html).toContain('Read a.ts');
    expect(html).toContain('Bash ls');
    expect(html).toContain('Looking at the log');
  });

  it('shows the allow card with its three choices', () => {
    const html = renderToStaticMarkup(
      <ChatView screen={screen({ permission: { tool: 'Bash', target: 'pnpm test' } })} />,
    );
    expect(html).toContain('Run `pnpm test`?');
    expect(html).toContain('Allow once');
    expect(html).toContain('Always allow');
    expect(html).toContain('Skip');
  });

  it('shows the walk row above the composer while a run is going', () => {
    const html = renderToStaticMarkup(
      <ChatView screen={screen({ walk: { index: 1 }, walkTotal: 4 })} />,
    );
    expect(html).toContain('Running 2 of 4…');
    expect(html).toContain('>Stop<');
  });

  it('shows the empty, loading and unreachable states', () => {
    const empty = renderToStaticMarkup(<ChatView screen={screen({ items: [] })} />);
    expect(empty).toContain('No messages yet');
    expect(empty).toContain('Ask Scout about paper-camp, or tell it what to file.');
    const loading = renderToStaticMarkup(<ChatView screen={screen({ load: 'loading' })} />);
    expect(loading).toContain('role="progressbar"');
    const unreachable = renderToStaticMarkup(<ChatView screen={screen({ load: 'unreachable' })} />);
    expect(unreachable).toContain('Couldn&#x27;t reach paper-camp.');
    expect(unreachable).toContain('Try again');
  });

  it('keeps the composer docking rule at the same breakpoint as the shell', () => {
    const css = readFileSync(new URL('../chat/chat.module.css', import.meta.url), 'utf8');
    expect(css).toContain('@media (min-width: 1024px)');
  });
});
