import type { ProjectEvidence } from '@/core/desk-discovery/evidence';
import { describe, expect, it } from 'vitest';
import { discoverDeskConfig } from './desk-discovery';

const EVIDENCE: ProjectEvidence = {
  packageManager: 'pnpm',
  scripts: [
    { name: 'dev', cmd: 'vite --port 3333' },
    { name: 'test', cmd: 'vitest run' },
  ],
  devPort: 3333,
  gitOriginSlug: 'acme/widgets',
  hasCiWorkflows: true,
  hasReleasePlease: true,
  nonJsManifests: [],
};

const VALID_BLOCK = {
  services: [{ name: 'Dev server', cmd: 'vite --port 3333', port: 3333 }],
  checks: [{ name: 'Tests', cmd: 'vitest run' }],
  ci: { repo: 'acme/widgets' },
};

describe('discoverDeskConfig', () => {
  it('returns the validated block from a raw JSON response', async () => {
    const result = await discoverDeskConfig(EVIDENCE, async () => JSON.stringify(VALID_BLOCK));
    expect(result).toEqual(VALID_BLOCK);
  });

  it('unwraps claude-code\'s {"result": "..."} envelope before parsing', async () => {
    const result = await discoverDeskConfig(EVIDENCE, async () =>
      JSON.stringify({ type: 'result', result: JSON.stringify(VALID_BLOCK) }),
    );
    expect(result).toEqual(VALID_BLOCK);
  });

  it('extracts a JSON object from surrounding prose', async () => {
    const result = await discoverDeskConfig(
      EVIDENCE,
      async () => `Here is the proposal:\n${JSON.stringify(VALID_BLOCK)}\nDone.`,
    );
    expect(result).toEqual(VALID_BLOCK);
  });

  it('rejects output that fails the desk config schema', async () => {
    await expect(
      discoverDeskConfig(EVIDENCE, async () =>
        JSON.stringify({ services: [{ name: 'Dev server' }] }),
      ),
    ).rejects.toThrow(/schema/);
  });

  it('rejects output with no JSON object at all', async () => {
    await expect(
      discoverDeskConfig(EVIDENCE, async () => 'I cannot help with that.'),
    ).rejects.toThrow(/parseable/);
  });

  it('rejects output with malformed JSON', async () => {
    await expect(discoverDeskConfig(EVIDENCE, async () => '{not valid json}')).rejects.toThrow(
      /valid JSON/,
    );
  });
});
