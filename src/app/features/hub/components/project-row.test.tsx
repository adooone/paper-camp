import { describe, expect, it } from 'vitest';
import type { RuntimeStatus } from '../hooks';
import { StatusStamp } from './project-row';

const status = (overrides: Partial<RuntimeStatus> = {}): RuntimeStatus => ({
  name: null,
  reachable: true,
  remoteVersion: '0.28.0',
  versionSkew: false,
  schemeBlocked: false,
  runningPlanTitle: null,
  ...overrides,
});

describe('StatusStamp', () => {
  it('shows Checking… when the status has not resolved yet', () => {
    const tree = StatusStamp({ status: undefined });
    expect(tree.props.children).toBe('Checking…');
  });

  it('shows a running stamp with the plan title, ahead of every reachability stamp', () => {
    const tree = StatusStamp({
      status: status({
        runningPlanTitle: 'Ship the thing',
        reachable: false,
        schemeBlocked: true,
        versionSkew: true,
      }),
    });
    expect(tree.props.variant).toBe('success');
    expect(tree.props.children).toEqual(['Running: ', 'Ship the thing']);
  });

  it('falls back to Can execute when nothing is running and the runtime is healthy', () => {
    const tree = StatusStamp({ status: status() });
    expect(tree.props.children).toBe('Can execute');
  });

  it('falls back to Offline when nothing is running and the runtime is unreachable', () => {
    const tree = StatusStamp({ status: status({ reachable: false, remoteVersion: null }) });
    expect(tree.props.children).toBe('Offline');
  });
});
