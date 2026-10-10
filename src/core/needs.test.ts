import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseNeedsRef, resolveNeedsRefs } from './needs';
import { formatEntityFile } from './serialize';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProject(ideas: { id: string; title: string }[]): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-needs-'));
  dirs.push(dir);
  const ideasDir = join(dir, 'papercamp', 'ideas');
  await mkdir(ideasDir, { recursive: true });
  for (const idea of ideas) {
    const content = formatEntityFile({
      id: idea.id,
      title: idea.title,
      status: 'idea',
      created: '2026-01-01',
    });
    await writeFile(join(ideasDir, `${idea.id}.md`), `${content}\n`, 'utf-8');
  }
  return dir;
}

describe('parseNeedsRef', () => {
  it('parses a same-project ref with no slug', () => {
    expect(parseNeedsRef('IDEA-14')).toEqual({ raw: 'IDEA-14', id: 'IDEA-14' });
  });

  it('parses a cross-project ref as slug/id', () => {
    expect(parseNeedsRef('paper-ui/IDEA-14')).toEqual({
      raw: 'paper-ui/IDEA-14',
      projectSlug: 'paper-ui',
      id: 'IDEA-14',
    });
  });
});

describe('resolveNeedsRefs', () => {
  it('resolves a same-project ref against the current project', async () => {
    const root = await makeProject([{ id: 'IDEA-1', title: 'Local idea' }]);
    const result = await resolveNeedsRefs(root, ['IDEA-1', 'IDEA-99'], {
      version: 1,
      projects: [],
    });
    expect(result).toEqual([
      { raw: 'IDEA-1', found: true },
      { raw: 'IDEA-99', found: false },
    ]);
  });

  it('resolves a cross-project ref through the machine registry', async () => {
    const root = await makeProject([]);
    const otherRoot = await makeProject([{ id: 'IDEA-14', title: 'Other project idea' }]);
    const registry = {
      version: 1 as const,
      projects: [{ slug: 'paper-ui', path: otherRoot, name: 'paper-ui' }],
    };
    const result = await resolveNeedsRefs(root, ['paper-ui/IDEA-14'], registry);
    expect(result).toEqual([{ raw: 'paper-ui/IDEA-14', found: true }]);
  });

  it('reports an unregistered project slug as unresolved rather than throwing', async () => {
    const root = await makeProject([]);
    const result = await resolveNeedsRefs(root, ['missing-project/IDEA-1'], {
      version: 1,
      projects: [],
    });
    expect(result).toEqual([{ raw: 'missing-project/IDEA-1', found: false }]);
  });
});
