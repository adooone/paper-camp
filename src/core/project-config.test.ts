import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_AGENTS } from '../types/index';
import { readProjectConfig } from './project-config';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeRoot(config?: unknown, roadmap?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-project-config-'));
  dirs.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  if (config !== undefined) {
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config), 'utf-8');
  }
  if (roadmap !== undefined) {
    await writeFile(join(root, 'ROADMAP.md'), roadmap, 'utf-8');
  }
  return root;
}

describe('readProjectConfig', () => {
  it('falls back to the defaults when config.json is missing', async () => {
    const root = await makeRoot();
    const config = readProjectConfig(root);
    expect(config.raw).toBeNull();
    expect(config.defaultAgents).toEqual(DEFAULT_AGENTS);
    expect(config.desk).toBeUndefined();
    expect(config.subjects).toEqual([]);
  });

  it('coerces per-bucket defaultAgents, filling unset buckets from the defaults', async () => {
    const root = await makeRoot({
      defaultAgents: { phase: 'opencode' },
    });
    const config = readProjectConfig(root);
    expect(config.defaultAgents.phase).toEqual({ agent: 'opencode' });
    expect(config.defaultAgents.feedback).toEqual(DEFAULT_AGENTS.feedback);
  });

  it('expands a legacy single defaultAgent into every bucket', async () => {
    const root = await makeRoot({ defaultAgent: 'opencode' });
    const config = readProjectConfig(root);
    expect(config.defaultAgents.phase).toEqual({ agent: 'opencode' });
    expect(config.defaultAgents.nightShift).toEqual({ agent: 'opencode' });
  });

  it('drops a malformed desk manifest instead of throwing', async () => {
    const root = await makeRoot({ desk: { services: 'not-an-array' } });
    const config = readProjectConfig(root);
    expect(config.desk).toBeUndefined();
  });

  it('keeps a valid desk manifest', async () => {
    const root = await makeRoot({ desk: { services: [] } });
    const config = readProjectConfig(root);
    expect(config.desk).toEqual({ services: [] });
  });

  it('derives subjects from ROADMAP.md', async () => {
    const root = await makeRoot(
      {},
      [
        '## The goal',
        '',
        '## Horizon 1 — Now',
        '',
        '- **Feature A** — do the thing',
        '  - → IDEA-1',
      ].join('\n'),
    );
    const config = readProjectConfig(root);
    expect(config.subjects).toContain('Feature A');
  });
});
