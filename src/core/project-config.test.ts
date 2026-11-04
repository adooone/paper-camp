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

  it('coerces per-group defaultAgents, filling unset groups from the defaults', async () => {
    const root = await makeRoot({
      defaultAgents: { build: 'opencode' },
    });
    const config = readProjectConfig(root);
    expect(config.defaultAgents.build).toEqual({ agent: 'opencode' });
    expect(config.defaultAgents.chat).toEqual(DEFAULT_AGENTS.chat);
  });

  it('folds the per-task keys of an older config into the four groups', async () => {
    const root = await makeRoot({
      defaultAgents: {
        phase: { agent: 'claude-code', model: 'sonnet', effort: 'medium' },
        planDraft: { agent: 'claude-code', model: 'opus', effort: 'high' },
        ideaExtend: { agent: 'opencode' },
        commitSuggest: { agent: 'claude-code', model: 'haiku' },
        feedback: { agent: 'claude-code', model: 'sonnet' },
        codeReview: { agent: 'claude-code', model: 'opus', effort: 'high' },
        nightShift: { agent: 'opencode' },
      },
    });
    const config = readProjectConfig(root);
    expect(config.defaultAgents).toEqual({
      build: { agent: 'claude-code', model: 'sonnet', effort: 'medium' },
      plan: { agent: 'claude-code', model: 'opus', effort: 'high' },
      chat: { agent: 'claude-code', model: 'opus', effort: 'high' },
      quick: { agent: 'claude-code', model: 'haiku' },
    });
  });

  it('prefers a group key over the per-task keys it replaced', async () => {
    const root = await makeRoot({
      defaultAgents: { plan: { agent: 'opencode' }, planDraft: { agent: 'claude-code' } },
    });
    expect(readProjectConfig(root).defaultAgents.plan).toEqual({ agent: 'opencode' });
  });

  it('expands a legacy single defaultAgent into every group', async () => {
    const root = await makeRoot({ defaultAgent: 'opencode' });
    const config = readProjectConfig(root);
    expect(config.defaultAgents.build).toEqual({ agent: 'opencode' });
    expect(config.defaultAgents.quick).toEqual({ agent: 'opencode' });
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
