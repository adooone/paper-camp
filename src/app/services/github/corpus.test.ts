import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubCorpusConfig } from './config-store';

interface FakeFile {
  content: string;
  sha: string;
}

const files = new Map<string, FakeFile>();
let shaCounter = 0;

function reset() {
  files.clear();
  shaCounter = 0;
}

vi.mock('./client', () => ({
  getFile: vi.fn(async (_config: GithubCorpusConfig, path: string) => {
    const file = files.get(path);
    return file ? { ...file } : null;
  }),
  listDir: vi.fn(async (_config: GithubCorpusConfig, dir: string) => {
    const prefix = `${dir}/`;
    const names = new Set<string>();
    for (const path of files.keys()) {
      if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
        names.add(path.slice(prefix.length));
      }
    }
    return [...names].map((name) => ({ name, type: 'file' as const }));
  }),
  putFile: vi.fn(
    async (_config: GithubCorpusConfig, path: string, content: string, _message: string) => {
      const sha = `sha-${shaCounter++}`;
      files.set(path, { content, sha });
      return { sha };
    },
  ),
  deleteFile: vi.fn(async (_config: GithubCorpusConfig, path: string) => {
    files.delete(path);
  }),
}));

const { fetchGithubIdeas, fetchGithubPlans, createGithubIdea, saveGithubEntity } = await import(
  './corpus'
);

const config: GithubCorpusConfig = { owner: 'acme', repo: 'widgets', token: 'ghp_x' };

function seedIdea(id: string, extra = ''): void {
  files.set(`papercamp/ideas/${id}.md`, {
    content: `---\nid: ${id}\ntitle: ${id} title\ncreated: '2026-01-01'\n---\n\nBody for ${id}.${extra}\n`,
    sha: `seed-${id}`,
  });
}

function seedConfig(nextIdeaId: number): void {
  files.set('papercamp/config.json', {
    content: JSON.stringify({ nextId: { idea: nextIdeaId } }),
    sha: 'config-sha',
  });
}

describe('github corpus', () => {
  beforeEach(() => reset());

  it('fetchGithubIdeas reads plan-kind entities as plans, note-kind as ideas', async () => {
    seedIdea('IDEA-1');
    files.set('papercamp/ideas/IDEA-2.md', {
      content:
        "---\nid: IDEA-2\ntitle: A note\nkind: note\ncreated: '2026-01-01'\n---\n\nJust a note.\n",
      sha: 'seed-2',
    });

    const plans = await fetchGithubPlans(config);
    expect(plans.entries.map((e) => e.id)).toEqual(['IDEA-1']);
    expect(plans.resolved).toBe(false);

    const ideas = await fetchGithubIdeas(config);
    expect(ideas.entries.map((e) => e.id)).toEqual(['IDEA-2']);
  });

  it('createGithubIdea mints the next id from config.json and writes the entity file', async () => {
    seedConfig(7);

    const id = await createGithubIdea(config, { title: 'New idea', content: 'Some body' });
    expect(id).toBe('IDEA-7');

    const written = files.get('papercamp/ideas/IDEA-7.md');
    expect(written?.content).toContain('id: IDEA-7');
    expect(written?.content).toContain('Some body');

    const config1 = JSON.parse(files.get('papercamp/config.json')?.content ?? '{}');
    expect(config1.nextId.idea).toBe(8);
  });

  it('createGithubIdea writes a note-kind file for kind: note', async () => {
    seedConfig(1);
    await createGithubIdea(config, { title: 'A quick note', kind: 'note' });
    const written = files.get('papercamp/ideas/IDEA-1.md');
    expect(written?.content).toContain('kind: note');
    expect(written?.content).toContain('status: open');
  });

  it('saveGithubEntity updates a plan field and stamps `updated`', async () => {
    seedIdea('IDEA-1');
    await saveGithubEntity(config, 'IDEA-1', { body: 'Updated body' });
    const written = files.get('papercamp/ideas/IDEA-1.md');
    expect(written?.content).toContain('Updated body');
    expect(written?.content).toMatch(/updated:/);
  });

  it('saveGithubEntity rejects a body edit on a done entity', async () => {
    files.set('papercamp/ideas/IDEA-1.md', {
      content:
        "---\nid: IDEA-1\ntitle: Closed\nstatus: done\ncreated: '2026-01-01'\n---\n\nBody.\n",
      sha: 'seed-1',
    });
    await expect(saveGithubEntity(config, 'IDEA-1', { body: 'nope' })).rejects.toThrow(/read-only/);
  });

  it('saveGithubEntity throws when the entity cannot be found', async () => {
    await expect(saveGithubEntity(config, 'IDEA-999', { body: 'x' })).rejects.toThrow(
      'entity not found',
    );
  });

  it('saveGithubEntity demotes another in-progress plan when one is set in-progress', async () => {
    files.set('papercamp/ideas/IDEA-1.md', {
      content:
        "---\nid: IDEA-1\ntitle: First\nstatus: in-progress\ncreated: '2026-01-01'\n---\n\nBody.\n\n### Phases\n- [ ] step one\n",
      sha: 'seed-1',
    });
    files.set('papercamp/ideas/IDEA-2.md', {
      content:
        "---\nid: IDEA-2\ntitle: Second\nstatus: planned\ncreated: '2026-01-01'\n---\n\nBody.\n\n### Phases\n- [ ] step one\n",
      sha: 'seed-2',
    });

    await saveGithubEntity(config, 'IDEA-2', { status: 'in-progress' });

    expect(files.get('papercamp/ideas/IDEA-1.md')?.content).toContain('status: planned');
    expect(files.get('papercamp/ideas/IDEA-2.md')?.content).toContain('status: in-progress');
  });

  it('saveGithubEntity archives a dropped entity into ideas/archive', async () => {
    seedIdea('IDEA-1');
    await saveGithubEntity(config, 'IDEA-1', { status: 'dropped' });
    expect(files.has('papercamp/ideas/IDEA-1.md')).toBe(false);
    expect(files.get('papercamp/ideas/archive/IDEA-1.md')?.content).toContain('status: dropped');
  });
});
