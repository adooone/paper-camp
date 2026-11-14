import { Spinner } from '@dendelion/folk-ui';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { ChatTurnInfo } from '../hooks/use-chat-stage';
import { ChatStageBubble } from './chat-stage-bubble';
import { EntityLinkText } from './entity-link-text';

function collect(node: ReactNode, match: (el: ReactElement) => boolean): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => collect(child, match));
  if (!node || typeof node !== 'object' || !('type' in node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [...(match(element) ? [element] : []), ...collect(element.props?.children, match)];
}

const texts = (node: ReactNode): string[] =>
  collect(node, (el) => typeof (el.props as { children?: unknown }).children === 'string').map(
    (el) => (el.props as { children: string }).children,
  );

const turn = (overrides: Partial<ChatTurnInfo> = {}): ChatTurnInfo => ({
  live: true,
  stage: 'thinking',
  text: '',
  tools: [],
  elapsedSeconds: 0,
  ...overrides,
});

describe('ChatStageBubble', () => {
  it('shows the stage line before any text arrives', () => {
    const tree = ChatStageBubble({ turn: turn({ stage: 'reading' }) });
    expect(texts(tree)).toContain('Reading…');
    expect(collect(tree, (el) => el.type === EntityLinkText)).toHaveLength(0);
  });

  it('renders the streamed reply with the spinner still running', () => {
    const tree = ChatStageBubble({ turn: turn({ stage: 'replying', text: 'See IDEA-331' }) });
    const reply = collect(tree, (el) => el.type === EntityLinkText);
    expect(reply.map((el) => (el.props as { text: string }).text)).toEqual(['See IDEA-331']);
    expect(collect(tree, (el) => el.type === Spinner)).toHaveLength(1);
    expect(texts(tree)).not.toContain('Replying…');
  });

  it('lists the latest tool lines above the bubble', () => {
    const tools = [
      'Reading a.ts',
      'Reading b.ts',
      'Reading c.ts',
      'Reading d.ts',
      'Filed IDEA-333',
    ];
    const shown = texts(ChatStageBubble({ turn: turn({ tools }) }));
    expect(shown).toEqual(expect.arrayContaining(tools.slice(1)));
    expect(shown).not.toContain('Reading a.ts');
  });

  it('drops the spinner once the turn has ended', () => {
    const tree = ChatStageBubble({ turn: turn({ live: false, stage: null, text: 'Done.' }) });
    expect(collect(tree, (el) => el.type === Spinner)).toHaveLength(0);
  });

  it('hints at a slow CLI start after 30 s with nothing streamed', () => {
    const shown = texts(ChatStageBubble({ turn: turn({ elapsedSeconds: 31 }) }));
    expect(shown).toContain('The agent CLI can take a minute to start.');
  });
});
