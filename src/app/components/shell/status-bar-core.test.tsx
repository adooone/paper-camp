import { IconButton, Stamp } from '@dendelion/paper-ui';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StatusBarCore, type StatusBarCoreProps } from './status-bar-core';

const baseProps: StatusBarCoreProps = {
  gitBranch: 'main',
  gitAhead: 0,
  changedFileCount: 0,
  agentActive: false,
  activeTaskStatus: undefined,
  agentNotSignedIn: false,
  capabilityGapCount: 0,
  unreadNotificationCount: 0,
  onOpenSetup: () => {},
  onOpenGit: () => {},
  onOpenNotifications: () => {},
};

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

describe('StatusBarCore', () => {
  it('shows the branch name and "clean" when nothing changed', () => {
    const tree = StatusBarCore(baseProps);
    const codes = collect(tree, (el) => el.type === 'code');
    expect(textOf(codes[0]?.props.children as ReactNode)).toBe('main');
    const secondary = collect(tree, (el) => el.type === 'span').map(textOf);
    expect(secondary).toContain('clean');
    expect(secondary.some((text) => text.startsWith('↑'))).toBe(false);
  });

  it('falls back to "no branch" when gitBranch is null', () => {
    const tree = StatusBarCore({ ...baseProps, gitBranch: null });
    const codes = collect(tree, (el) => el.type === 'code');
    expect(textOf(codes[0]?.props.children as ReactNode)).toBe('no branch');
  });

  it('shows the ahead count and changed file count', () => {
    const tree = StatusBarCore({ ...baseProps, gitAhead: 3, changedFileCount: 2 });
    const spans = collect(tree, (el) => el.type === 'span').map(textOf);
    expect(spans).toContain('↑3');
    expect(spans).toContain('2 changed');
  });

  it('renders an agent spinner only while a task is active', () => {
    const idle = collect(
      StatusBarCore(baseProps),
      (el) => (el.props as { label?: string }).label?.startsWith('Agent') ?? false,
    );
    expect(idle).toHaveLength(0);

    const active = collect(
      StatusBarCore({ ...baseProps, agentActive: true, activeTaskStatus: 'running' }),
      (el) => (el.props as { label?: string }).label?.startsWith('Agent') ?? false,
    );
    expect(active[0]?.props.label).toBe('Agent running…');
  });

  it('shows a not-signed-in stamp that opens setup', () => {
    const onOpenSetup = vi.fn();
    const tree = StatusBarCore({ ...baseProps, agentNotSignedIn: true, onOpenSetup });
    const stamps = collect(tree, (el) => el.type === Stamp);
    expect(textOf(stamps[0]?.props.children as ReactNode)).toBe('Agent not signed in');

    const triggers = collect(
      tree,
      (el) => el.type === 'button' && el.props.onClick === onOpenSetup,
    );
    expect(triggers).toHaveLength(1);
  });

  it('shows a setup gap stamp with the gap count', () => {
    const tree = StatusBarCore({ ...baseProps, capabilityGapCount: 2 });
    const stamps = collect(tree, (el) => el.type === Stamp);
    expect(textOf(stamps[0]?.props.children as ReactNode)).toBe('Setup (2)');
  });

  it('omits the not-signed-in and setup stamps when there is nothing to report', () => {
    const stamps = collect(StatusBarCore(baseProps), (el) => el.type === Stamp);
    expect(stamps).toHaveLength(0);
  });

  it('omits the notification badge when there is nothing unread', () => {
    const stamps = collect(StatusBarCore(baseProps), (el) => el.type === Stamp);
    expect(stamps).toHaveLength(0);
  });

  it('shows the unread count on the notification badge', () => {
    const tree = StatusBarCore({ ...baseProps, unreadNotificationCount: 3 });
    const stamps = collect(tree, (el) => el.type === Stamp);
    expect(textOf(stamps[0]?.props.children as ReactNode)).toBe('3');
  });

  it('opens notifications when the bell button is clicked', () => {
    const onOpenNotifications = vi.fn();
    const tree = StatusBarCore({ ...baseProps, onOpenNotifications });
    const bell = collect(
      tree,
      (el) => el.type === IconButton && el.props.label === 'Notifications',
    )[0];
    (bell?.props.onClick as () => void)?.();
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('opens `/git` when the git button is clicked', () => {
    const onOpenGit = vi.fn();
    const tree = StatusBarCore({ ...baseProps, onOpenGit });
    const gitButton = collect(tree, (el) => el.type === IconButton && el.props.label === 'Git')[0];
    (gitButton?.props.onClick as () => void)?.();
    expect(onOpenGit).toHaveBeenCalledTimes(1);
  });
});
