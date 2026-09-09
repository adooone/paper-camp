import type { MachineProjectSummary } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { MachineProjectRow, machineReachMessage } from './remembered-machines-cards';

const project = (overrides: Partial<MachineProjectSummary> = {}): MachineProjectSummary => ({
  slug: 'demo',
  name: 'Demo',
  mounted: false,
  busy: false,
  missing: false,
  ...overrides,
});

describe('MachineProjectRow', () => {
  it('is clickable and unstyled for a present project', () => {
    const onOpen = vi.fn();
    const tree = MachineProjectRow({ project: project(), onOpen });

    expect(tree.props.disabled).toBe(false);
    expect(tree.props.className).not.toMatch(/opacity|cursor-not-allowed/);
    tree.props.onClick();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is greyed and unpickable for a missing project', () => {
    const onOpen = vi.fn();
    const tree = MachineProjectRow({ project: project({ missing: true }), onOpen });

    expect(tree.props.disabled).toBe(true);
    expect(tree.props.className).toMatch(/opacity-50/);
    expect(tree.props.className).toMatch(/cursor-not-allowed/);
    expect(tree.props.onClick).toBeUndefined();
  });
});

describe('machineReachMessage', () => {
  it('names the browser permission while a request is still open', () => {
    expect(machineReachMessage('waiting', 'deimos.pitta-ray.ts.net', 0)).toMatch(
      /allow this site to access your local network/,
    );
  });

  it('explains an unreachable machine in terms of the network and the permission', () => {
    const message = machineReachMessage('unreachable', 'deimos.pitta-ray.ts.net', 0);
    expect(message).toMatch(/Couldn't reach deimos.pitta-ray.ts.net/);
    expect(message).toMatch(/local-network access/);
  });

  it('says nothing once projects are listed, and why when none are pickable', () => {
    expect(machineReachMessage('ready', 'deimos', 3)).toBeNull();
    expect(machineReachMessage('ready', 'deimos', 0)).toMatch(/already in your list/);
  });
});
