import { QuestionCard } from '@/app/features/plans/components/question-card';
import type { ThreadMessage } from '@/types/index';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from './chat-message';
import { EntityLinkText } from './entity-link-text';

function findByType(node: ReactNode, type: unknown): ReactElement | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object' || !('type' in node)) return null;
  const element = node as ReactElement;
  if (element.type === type) return element;
  return findByType(element.props?.children as ReactNode, type);
}

function message(overrides: Partial<ThreadMessage> = {}): ThreadMessage {
  return { kind: 'chat', date: '2026-10-16T14:05', text: 'Hello', ...overrides };
}

describe('ChatMessage question states', () => {
  it('renders a question with no options through QuestionCard', () => {
    const msg = message({ kind: 'question', text: 'What now?', state: 'open' });
    const tree = ChatMessage({ message: msg, onAnswer: vi.fn() });
    const card = findByType(tree, QuestionCard);
    expect(card).not.toBeNull();
    expect(card?.props.message).toBe(msg);
  });

  it('renders a resolved question through QuestionCard unchanged', () => {
    const msg = message({
      kind: 'question',
      text: 'What now?',
      state: 'resolved',
      options: [{ label: 'A', consequence: '' }],
    });
    const tree = ChatMessage({ message: msg, onAnswer: vi.fn() });
    const card = findByType(tree, QuestionCard);
    expect(card?.props.message).toBe(msg);
  });
});

describe('ChatMessage rendering', () => {
  it('shows Scout and the time for an agent reply, with no clamp on the text', () => {
    const msg = message({ from: 'agent', text: 'A long reply that must not be truncated.' });
    const tree = ChatMessage({ message: msg, onAnswer: vi.fn() });
    const link = findByType(tree, EntityLinkText);
    expect(link?.props.text).toBe(msg.text);
  });

  it('formats a date-only message by showing the date as-is', () => {
    const msg = message({ from: 'agent', date: '2026-10-16' });
    const tree = ChatMessage({ message: msg, onAnswer: vi.fn() });
    const link = findByType(tree, EntityLinkText);
    expect(link).not.toBeNull();
  });
});
