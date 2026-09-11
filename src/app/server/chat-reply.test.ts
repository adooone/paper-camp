import { describe, expect, it, vi } from 'vitest';
import { replyToChat } from './chat-reply';

const emptyContext = { entities: [], taskLog: [], agentStatus: [] };

function moveOutput(move: unknown): string {
  return JSON.stringify({ result: JSON.stringify(move) });
}

describe('replyToChat', () => {
  it('creates a new idea for the add_idea move and links to it', async () => {
    const createIdea = vi.fn(async () => 'IDEA-42');
    const applyToEntity = vi.fn();
    const reply = await replyToChat(
      [{ kind: 'chat', date: '2026-09-11', text: 'add dark mode' }],
      emptyContext,
      {
        runPrompt: async () =>
          moveOutput({ move: 'add_idea', title: 'Dark mode toggle', content: 'Body.' }),
        createIdea,
        applyToEntity,
      },
    );

    expect(createIdea).toHaveBeenCalledWith('Dark mode toggle', 'Body.');
    expect(applyToEntity).not.toHaveBeenCalled();
    expect(reply).toBe('Added [[IDEA-42]] — Dark mode toggle.');
  });

  it('appends the latest message to an entity through the feedback path', async () => {
    const applyToEntity = vi.fn(async () => ({ replyText: 'Noted.' }));
    const reply = await replyToChat(
      [{ kind: 'chat', date: '2026-09-11', text: 'the log view is clipped again' }],
      emptyContext,
      {
        runPrompt: async () => moveOutput({ move: 'entity', entityId: 'IDEA-9' }),
        createIdea: vi.fn(),
        applyToEntity,
      },
    );

    expect(applyToEntity).toHaveBeenCalledWith('IDEA-9', 'the log view is clipped again');
    expect(reply).toBe('Noted. — see [[IDEA-9]].');
  });

  it('reports when the named entity does not exist', async () => {
    const reply = await replyToChat(
      [{ kind: 'chat', date: '2026-09-11', text: 'x' }],
      emptyContext,
      {
        runPrompt: async () => moveOutput({ move: 'entity', entityId: 'IDEA-404' }),
        createIdea: vi.fn(),
        applyToEntity: async () => null,
      },
    );

    expect(reply).toBe("Couldn't find IDEA-404 to post that to.");
  });

  it('returns the drafted reply directly for the answer move', async () => {
    const reply = await replyToChat(
      [{ kind: 'chat', date: '2026-09-11', text: 'x' }],
      emptyContext,
      {
        runPrompt: async () => moveOutput({ move: 'answer', reply: 'Nothing is running.' }),
        createIdea: vi.fn(),
        applyToEntity: vi.fn(),
      },
    );

    expect(reply).toBe('Nothing is running.');
  });

  it('throws when the agent output has no JSON block', async () => {
    await expect(
      replyToChat([{ kind: 'chat', date: '2026-09-11', text: 'x' }], emptyContext, {
        runPrompt: async () => 'not json at all',
        createIdea: vi.fn(),
        applyToEntity: vi.fn(),
      }),
    ).rejects.toThrow('Agent did not return a reply');
  });
});
