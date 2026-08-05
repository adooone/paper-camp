import { Button, Stamp } from '@dendelion/paper-ui';
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
  gitBranchHygiene: null,
  commitInFlight: false,
  gitActionBusy: false,
  pushing: false,
  syncing: false,
  pulling: false,
  onSync: () => {},
  onPush: () => {},
  onPull: () => {},
  onQuickCommit: () => {},
  onOpenSetup: () => {},
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

const buttons = (props: StatusBarCoreProps) =>
  collect(StatusBarCore(props), (el) => el.type === Button);

const findButton = (props: StatusBarCoreProps, iconName: string) =>
  buttons(props).find(
    (btn) => ((btn.props.icon as Elementish)?.type as { name?: string })?.name === iconName,
  );

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

  it('disables Sync when the repo is already clean on main', () => {
    const clean = findButton({ ...baseProps, gitBranchHygiene: 'clean-on-main' }, 'MergeIcon');
    expect(clean?.props.disabled).toBe(true);

    const dirty = findButton({ ...baseProps, gitBranchHygiene: null }, 'MergeIcon');
    expect(dirty?.props.disabled).toBe(false);
  });

  it('disables Push when there is nothing to push and labels it with the ahead count', () => {
    const nothingToPush = findButton(baseProps, 'PushIcon');
    expect(nothingToPush?.props.disabled).toBe(true);
    expect(textOf(nothingToPush?.props.children as ReactNode)).toBe('Push');

    const withCommits = findButton({ ...baseProps, gitAhead: 4 }, 'PushIcon');
    expect(withCommits?.props.disabled).toBe(false);
    expect(textOf(withCommits?.props.children as ReactNode)).toBe('Push (4)');
  });

  it('disables git action buttons while another git action is in flight', () => {
    const busy = { ...baseProps, gitActionBusy: true, gitAhead: 1 };
    expect(findButton(busy, 'MergeIcon')?.props.disabled).toBe(true);
    expect(findButton(busy, 'PushIcon')?.props.disabled).toBe(true);
    expect(findButton(busy, 'PullIcon')?.props.disabled).toBe(true);
  });

  it('labels git action buttons with their in-flight state', () => {
    const inFlight = { ...baseProps, syncing: true, pushing: true, pulling: true, gitAhead: 1 };
    expect(textOf(findButton(inFlight, 'MergeIcon')?.props.children as ReactNode)).toBe('Syncing…');
    expect(textOf(findButton(inFlight, 'PushIcon')?.props.children as ReactNode)).toBe('Pushing…');
    expect(textOf(findButton(inFlight, 'PullIcon')?.props.children as ReactNode)).toBe('Pulling…');
  });

  it('disables Commit when there is nothing to commit or a commit is already running', () => {
    const clean = findButton(baseProps, 'CommitIcon');
    expect(clean?.props.disabled).toBe(true);
    expect(textOf(clean?.props.children as ReactNode)).toBe('Commit');

    const dirty = findButton({ ...baseProps, changedFileCount: 5 }, 'CommitIcon');
    expect(dirty?.props.disabled).toBe(false);
    expect(textOf(dirty?.props.children as ReactNode)).toBe('Commit (5)');

    const inFlight = findButton(
      { ...baseProps, changedFileCount: 5, commitInFlight: true },
      'CommitIcon',
    );
    expect(inFlight?.props.disabled).toBe(true);
    expect(textOf(inFlight?.props.children as ReactNode)).toBe('Committing…');
  });

  it('wires each action button to its callback', () => {
    const onSync = vi.fn();
    const onPush = vi.fn();
    const onPull = vi.fn();
    const onQuickCommit = vi.fn();
    const props = {
      ...baseProps,
      gitAhead: 1,
      changedFileCount: 1,
      onSync,
      onPush,
      onPull,
      onQuickCommit,
    };

    const click = (btn?: Elementish) => (btn?.props.onClick as (() => void) | undefined)?.();
    click(findButton(props, 'MergeIcon'));
    click(findButton(props, 'PushIcon'));
    click(findButton(props, 'PullIcon'));
    click(findButton(props, 'CommitIcon'));

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onQuickCommit).toHaveBeenCalledTimes(1);
  });
});
