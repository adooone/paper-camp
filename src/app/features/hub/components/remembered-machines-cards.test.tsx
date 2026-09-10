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

  it('has no action stamp for an idle project', () => {
    const tree = MachineProjectRow({ project: project({ busy: false }), onOpen: vi.fn() });
    expect(tree.props.action).toBeUndefined();
  });

  it('shows a Running stamp for a busy project, the same as the project list', () => {
    const tree = MachineProjectRow({ project: project({ busy: true }), onOpen: vi.fn() });
    expect(tree.props.action.props.variant).toBe('success');
    expect(tree.props.action.props.children).toBe('Running');
  });
});

describe('MachineProjectRow', () => {
  it('shows the slug beside the name when they differ, so two projects with one name read apart', () => {
    const tree = MachineProjectRow({
      project: project({ slug: 'paper-camp-build', name: 'paper-camp' }),
      onOpen: vi.fn(),
    });
    const [, slug] = tree.props.children as [unknown, { props: { children: string } } | false];
    expect(slug && slug.props.children).toBe('paper-camp-build');
  });

  it('shows the name alone when it already is the slug', () => {
    const tree = MachineProjectRow({
      project: project({ slug: 'demo', name: 'demo' }),
      onOpen: vi.fn(),
    });
    const [, slug] = tree.props.children as [unknown, unknown];
    expect(slug).toBe(false);
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
