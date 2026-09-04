import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('omits the illustration slot when none is given', () => {
    const tree = EmptyState({ message: 'No changed files.' });
    const [illustration] = tree.props.children as [unknown, unknown, unknown];
    expect(illustration).toBeFalsy();
  });

  it('renders the illustration, muted by opacity rather than a hardcoded colour', () => {
    const illustration = <svg role="img" />;
    const tree = EmptyState({ message: 'No changed files.', illustration });
    const [wrapper] = tree.props.children as [ReactElement, unknown, unknown];
    expect(wrapper.type).toBe('div');
    expect(wrapper.props.children).toBe(illustration);
    expect(wrapper.props.className).toBe('opacity-60');
  });

  it('renders the message as handwritten copy, muted the same way on parchment or chalkboard', () => {
    const tree = EmptyState({ message: 'No tasks have run yet.' });
    const [, message] = tree.props.children as [unknown, ReactElement, unknown];
    expect(message.type).toBe('p');
    expect(message.props.children).toBe('No tasks have run yet.');
    expect(message.props.className).toContain('font-handwritten');
    expect(message.props.className).toContain('opacity-60');
    expect(message.props.className).not.toMatch(/var\(--pui-|#[0-9a-f]{3,6}/i);
  });

  it('omits the action slot when none is given', () => {
    const tree = EmptyState({ message: 'No tasks have run yet.' });
    const [, , action] = tree.props.children as [unknown, unknown, unknown];
    expect(action).toBeFalsy();
  });

  it('renders a given action unmuted, alongside the message', () => {
    const action = <button type="button">Retry</button>;
    const tree = EmptyState({ message: 'No tasks have run yet.', action });
    const [, , renderedAction] = tree.props.children as [unknown, unknown, unknown];
    expect(renderedAction).toBe(action);
  });
});
