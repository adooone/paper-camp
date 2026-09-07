import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the message as handwritten copy, muted the same way on parchment or chalkboard', () => {
    const tree = EmptyState({ message: 'No tasks have run yet.' });
    const [message] = tree.props.children as [ReactElement, unknown];
    expect(message.type).toBe('p');
    expect(message.props.children).toBe('No tasks have run yet.');
    expect(message.props.className).toContain('font-handwritten');
    expect(message.props.className).toContain('opacity-60');
    expect(message.props.className).not.toMatch(/var\(--pui-|#[0-9a-f]{3,6}/i);
  });

  it('renders a given action unmuted, alongside the message', () => {
    const action = <button type="button">Retry</button>;
    const tree = EmptyState({ message: 'Nothing here.', action });
    const [, rendered] = tree.props.children as [unknown, ReactElement];
    expect(rendered).toBe(action);
  });

  it('omits the action slot when none is given', () => {
    const tree = EmptyState({ message: 'Nothing here.' });
    const [, rendered] = tree.props.children as [unknown, unknown];
    expect(rendered).toBeUndefined();
  });
});
