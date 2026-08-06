import { Menu } from '@dendelion/paper-ui';
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
  { id: 'focus', glance: 'Focus', panel: 'Focus panel', pinned: true },
  { id: 'desk', glance: 'Desk' },
];

const baseProps: ToolbarShellProps = {
  renderStatusBar: (trailing) => <div data-status-bar>{trailing}</div>,
  segments,
  activePanelId: null,
  onSelectSegment: () => {},
};

const trailingOf = (tree: unknown) =>
  collect(tree, (el) => 'data-status-bar' in el.props)[0]?.props.children;

describe('ToolbarShell', () => {
  it('hands the trailing content to the status bar renderer', () => {
    const tree = ToolbarShell(baseProps);
    expect(textOf(trailingOf(tree))).toContain('Focus');
  });

  it('renders pinned segments as inline buttons', () => {
    const tree = ToolbarShell(baseProps);
    const buttons = collect(trailingOf(tree), (el) => el.type === 'button');
    expect(buttons.map((btn) => textOf(btn.props.children as ReactNode))).toEqual(['Focus']);
    expect(buttons[0]?.props.disabled).toBe(false);
  });

  it('exposes aria-expanded for a pinned segment, matching the active panel', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'focus' });
    const buttons = collect(trailingOf(tree), (el) => el.type === 'button');
    expect(buttons[0]?.props['aria-expanded']).toBe(true);
  });

  it('calls onSelectSegment with the segment id when a pinned segment is clicked', () => {
    const onSelectSegment = vi.fn();
    const tree = ToolbarShell({ ...baseProps, onSelectSegment });
    const buttons = collect(trailingOf(tree), (el) => el.type === 'button');
    (buttons[0]?.props.onClick as () => void)();
    expect(onSelectSegment).toHaveBeenCalledWith('focus');
  });

  it('moves unpinned segments into the overflow menu', () => {
    const tree = ToolbarShell(baseProps);
    const menus = collect(trailingOf(tree), (el) => el.type === Menu);
    const items = menus[0]?.props.items as Array<{ id: string; disabled?: boolean }>;
    expect(items.map((item) => item.id)).toEqual(['desk']);
    expect(items[0]?.disabled).toBe(true);
  });

  it('selecting an overflow item calls onSelectSegment with its id', () => {
    const onSelectSegment = vi.fn();
    const tree = ToolbarShell({ ...baseProps, onSelectSegment });
    const menus = collect(trailingOf(tree), (el) => el.type === Menu);
    const items = menus[0]?.props.items as Array<{ id: string; onSelect?: () => void }>;
    items[0]?.onSelect?.();
    expect(onSelectSegment).toHaveBeenCalledWith('desk');
  });

  it('omits the overflow menu when every segment is pinned', () => {
    const tree = ToolbarShell({
      ...baseProps,
      segments: [{ id: 'focus', glance: 'Focus', panel: 'Focus panel', pinned: true }],
    });
    const menus = collect(trailingOf(tree), (el) => el.type === Menu);
    expect(menus).toHaveLength(0);
  });

  it('renders no panel when nothing is active', () => {
    const tree = ToolbarShell(baseProps);
    expect(textOf(tree).includes('Focus panel')).toBe(false);
  });

  it('renders the active segment panel above the bar', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'focus' });
    expect(textOf(tree)).toContain('Focus panel');
  });

  it('renders no panel when the active segment has none', () => {
    const tree = ToolbarShell({ ...baseProps, activePanelId: 'desk' });
    expect(textOf(tree).includes('Focus panel')).toBe(false);
  });
});
