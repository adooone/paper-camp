import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HubProjectRow } from './hub-machines';

const row: HubProjectRow = {
  runtimeUrl: 'http://localhost:4444',
  slug: 'paper-camp',
  packageName: null,
  stamp: { kind: 'idle' },
  lastOpenedAt: null,
};

function mockDeps(opts: {
  existingProjects?: { runtimeUrl: string; pairingToken: string | null }[];
  machineToken?: string | null;
  rememberedRoute?: string | null;
}) {
  const switchRuntime = vi.fn();
  const pairWithToken = vi.fn().mockResolvedValue(undefined);
  const resetProjectState = vi.fn();
  const checkRuntimeReachable = vi.fn();

  vi.doMock('./runtime-connection', () => ({ switchRuntime }));
  vi.doMock('./pairing-api', () => ({ pairWithToken }));
  vi.doMock('./project-registry', () => ({
    listProjects: () => opts.existingProjects ?? [],
    projectEntryId: (entry: { runtimeUrl: string }) => entry.runtimeUrl,
  }));
  vi.doMock('./machine-store', () => ({ machineToken: () => opts.machineToken ?? null }));
  vi.doMock('./last-route-store', () => ({
    lastRouteFor: () => opts.rememberedRoute ?? null,
  }));
  vi.doMock('@/app/stores/app-store', () => ({
    useAppStore: { getState: () => ({ resetProjectState, checkRuntimeReachable }) },
  }));

  return { switchRuntime, pairWithToken, resetProjectState, checkRuntimeReachable };
}

afterEach(() => {
  vi.resetModules();
});

describe('openProject', () => {
  it('adopts an unchosen project with the machine pairing token', async () => {
    const deps = mockDeps({ existingProjects: [], machineToken: 'mtok' });
    const { openProject } = await import('./open-project');

    const navigate = vi.fn();
    await openProject(row, 'https://machine.example', undefined, {
      navigate,
      routeExists: () => false,
    });

    expect(deps.switchRuntime).toHaveBeenCalledWith({
      runtimeUrl: row.runtimeUrl,
      pairingToken: 'mtok',
    });
    expect(deps.pairWithToken).toHaveBeenCalledWith('mtok');
  });

  it("keeps an already-chosen project's own pairing token rather than the machine's", async () => {
    const deps = mockDeps({
      existingProjects: [{ runtimeUrl: row.runtimeUrl, pairingToken: 'own-token' }],
      machineToken: 'mtok',
    });
    const { openProject } = await import('./open-project');

    await openProject(row, 'https://machine.example', undefined, {
      navigate: vi.fn(),
      routeExists: () => false,
    });

    expect(deps.switchRuntime).toHaveBeenCalledWith({
      runtimeUrl: row.runtimeUrl,
      pairingToken: 'own-token',
    });
    expect(deps.pairWithToken).toHaveBeenCalledWith('own-token');
  });

  it('skips pairing when no token applies', async () => {
    const deps = mockDeps({ existingProjects: [], machineToken: null });
    const { openProject } = await import('./open-project');

    await openProject(row, 'https://machine.example', undefined, {
      navigate: vi.fn(),
      routeExists: () => false,
    });

    expect(deps.pairWithToken).not.toHaveBeenCalled();
  });

  it('resets project state and re-probes reachability on switch', async () => {
    const deps = mockDeps({ existingProjects: [] });
    const { openProject } = await import('./open-project');

    await openProject(row, 'https://machine.example', undefined, {
      navigate: vi.fn(),
      routeExists: () => false,
    });

    expect(deps.resetProjectState).toHaveBeenCalled();
    expect(deps.checkRuntimeReachable).toHaveBeenCalled();
  });

  it('navigates to the given path over any remembered route', async () => {
    mockDeps({ existingProjects: [], rememberedRoute: '/ideas/IDEA-1' });
    const { openProject } = await import('./open-project');

    const navigate = vi.fn();
    await openProject(row, 'https://machine.example', '/plans', {
      navigate,
      routeExists: () => true,
    });

    expect(navigate).toHaveBeenCalledWith({ to: '/plans', replace: true });
  });

  it('falls back to the remembered route when no path is given', async () => {
    mockDeps({ existingProjects: [], rememberedRoute: '/ideas/IDEA-1' });
    const { openProject } = await import('./open-project');

    const navigate = vi.fn();
    await openProject(row, 'https://machine.example', undefined, {
      navigate,
      routeExists: () => true,
    });

    expect(navigate).toHaveBeenCalledWith({ to: '/ideas/IDEA-1', replace: true });
  });

  it('falls back to the root when there is neither a path nor a remembered route', async () => {
    mockDeps({ existingProjects: [], rememberedRoute: null });
    const { openProject } = await import('./open-project');

    const navigate = vi.fn();
    await openProject(row, 'https://machine.example', undefined, {
      navigate,
      routeExists: () => false,
    });

    expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true });
  });
});
