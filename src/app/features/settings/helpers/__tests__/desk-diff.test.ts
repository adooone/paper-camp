import type { DeskConfig } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { diffDeskConfig, isDiffEmpty } from '../desk-diff';

describe('diffDeskConfig', () => {
  it('reports every entry as added when current is empty', () => {
    const proposed: DeskConfig = {
      services: [{ name: 'Dev', cmd: 'vite' }],
      checks: [{ name: 'Tests', cmd: 'vitest run' }],
      ci: { repo: 'acme/widgets' },
    };
    const diff = diffDeskConfig(undefined, proposed);
    expect(diff.services).toEqual([{ kind: 'added', service: proposed.services![0] }]);
    expect(diff.checks).toEqual([{ kind: 'added', check: proposed.checks![0] }]);
    expect(diff.ci).toEqual({ kind: 'added', ci: proposed.ci! });
    expect(isDiffEmpty(diff)).toBe(false);
  });

  it('reports an empty diff when current matches proposed', () => {
    const cfg: DeskConfig = {
      services: [{ name: 'Dev', cmd: 'vite' }],
      checks: [{ name: 'Tests', cmd: 'vitest run' }],
    };
    const diff = diffDeskConfig(cfg, cfg);
    expect(isDiffEmpty(diff)).toBe(true);
  });

  it('reports services added, removed, and changed by cmd key', () => {
    const current: DeskConfig = {
      services: [
        { name: 'Dev', cmd: 'vite' },
        { name: 'Old', cmd: 'old-server' },
        { name: 'Renamed', cmd: 'api-server' },
      ],
    };
    const proposed: DeskConfig = {
      services: [
        { name: 'Dev', cmd: 'vite' },
        { name: 'New', cmd: 'fresh-server' },
        { name: 'Renamed', cmd: 'api-server', port: 4000 },
      ],
    };
    const diff = diffDeskConfig(current, proposed);
    expect(diff.services).toEqual([
      { kind: 'added', service: { name: 'New', cmd: 'fresh-server' } },
      {
        kind: 'changed',
        before: { name: 'Renamed', cmd: 'api-server' },
        after: { name: 'Renamed', cmd: 'api-server', port: 4000 },
      },
      { kind: 'removed', service: { name: 'Old', cmd: 'old-server' } },
    ]);
  });

  it('reports checks added and removed keyed by cmd', () => {
    const current: DeskConfig = {
      checks: [
        { name: 'Lint', cmd: 'biome check' },
        { name: 'Test', cmd: 'vitest run' },
      ],
    };
    const proposed: DeskConfig = {
      checks: [
        { name: 'Test', cmd: 'vitest run' },
        { name: 'Typecheck', cmd: 'tsc --noEmit' },
      ],
    };
    const diff = diffDeskConfig(current, proposed);
    expect(diff.checks).toEqual([
      { kind: 'added', check: { name: 'Typecheck', cmd: 'tsc --noEmit' } },
      { kind: 'removed', check: { name: 'Lint', cmd: 'biome check' } },
    ]);
  });

  it('reports ci as changed when repo/branch/releasePlease differ', () => {
    const current: DeskConfig = { ci: { repo: 'acme/widgets', branch: 'main' } };
    const proposed: DeskConfig = { ci: { repo: 'acme/widgets', branch: 'develop' } };
    const diff = diffDeskConfig(current, proposed);
    expect(diff.ci).toEqual({
      kind: 'changed',
      before: current.ci,
      after: proposed.ci,
    });
  });

  it('reports ci as removed when the proposal omits it', () => {
    const current: DeskConfig = { ci: { repo: 'acme/widgets' } };
    const proposed: DeskConfig = {};
    const diff = diffDeskConfig(current, proposed);
    expect(diff.ci).toEqual({ kind: 'removed', ci: current.ci });
  });
});
