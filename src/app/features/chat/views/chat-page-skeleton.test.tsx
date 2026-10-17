import { Card, PageTitle, RowSkeleton } from '@dendelion/folk-ui';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ChatPageSkeleton } from './chat-page-skeleton';

function findAllByType(node: ReactNode, type: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findAllByType(child, type, found);
    return found;
  }
  if (!node || typeof node !== 'object' || !('type' in node)) return found;
  const element = node as ReactElement;
  if (element.type === type) found.push(element);
  findAllByType(element.props?.children as ReactNode, type, found);
  return found;
}

describe('ChatPageSkeleton', () => {
  it('renders the title row', () => {
    const tree = ChatPageSkeleton();
    expect(findAllByType(tree, PageTitle)).toHaveLength(1);
  });

  it('renders a three-row skeleton for the thread area', () => {
    const tree = ChatPageSkeleton();
    expect(findAllByType(tree, RowSkeleton)).toHaveLength(3);
  });

  it('renders the composer card full width within the column', () => {
    const tree = ChatPageSkeleton();
    const [card] = findAllByType(tree, Card);
    expect(card.props.className).toContain('w-full');
  });
});
