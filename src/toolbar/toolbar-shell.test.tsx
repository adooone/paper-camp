import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type ToolbarSegment, ToolbarShell, type ToolbarShellProps } from './toolbar-shell';

type Elementish = { type: unknown; props: Record<string, unknown> };

const isElementish = (value: unknown): value is Elementish =>
  typeof value === 'object' && value !== null && 'props' in value && 'type' in value;

const collect = (node: unknown, predicate: (el: Elementish) => boolean, acc: Elementish[] = []) => {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, predicate, acc);
    return acc;
  }
  if (!isElementish(node)) return acc;
  if (predicate(node)) acc.push(node);
  collect(node.props.children, predicate, acc);
  return acc;
};

const textOf = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isElementish(node)) return textOf(node.props.children as ReactNode);
  return '';
};

const segments: ToolbarSegment[] = [
  { id: 'focus', glance: 'Focus', panel: 'Focus panel' },
  { id: 'desk', glance: 'Desk' },
];

const baseProps: ToolbarShellProps = {
  segments,
  activePanelId: null,
  onSelectSegment: () => {},
};

describe('ToolbarShell', () => {
  it('renders every segment glance in the docked bar', () => {
    const tree = ToolbarShell(baseProps);
    const buttons = collect(tree, (el) => el.type === 'button');
    expect(buttons.map((btn) => textOf(btn.props.children as ReactNode))).toEqual([
      'Focus',
      'Desk',
    ]);
  });

  it('disables segments with no panel', () => {
    const tree = ToolbarShell(baseProps);
    const buttons = collect(tree, (el) => el.type === 'button');
    expect(buttons[0]?.props.disabled).toBe(false);
    expect(buttons[1]?.props.disabled).toBe(true);
  });

  it('exposes aria-expanded for enabled segments, matching the active panel', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'focus' });
    const buttons = collect(tree, (el) => el.type === 'button');
    expect(buttons[0]?.props['aria-expanded']).toBe(true);
    expect(buttons[1]?.props['aria-expanded']).toBeUndefined();
  });

  it('calls onSelectSegment with the segment id on click', () => {
    const onSelectSegment = vi.fn();
    const tree = ToolbarShell({ ...baseProps, onSelectSegment });
    const buttons = collect(tree, (el) => el.type === 'button');
    (buttons[0]?.props.onClick as () => void)();
    expect(onSelectSegment).toHaveBeenCalledWith('focus');
  });

  it('renders no panel when nothing is active', () => {
    const tree = ToolbarShell(baseProps);
    expect(textOf(tree).includes('Focus panel')).toBe(false);
  });

  it('renders the active segment panel below the bar', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'focus' });
    expect(textOf(tree)).toContain('Focus panel');
  });

  it('renders no panel when the active segment has none', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'desk' });
    expect(textOf(tree).includes('Focus panel')).toBe(false);
  });
});
