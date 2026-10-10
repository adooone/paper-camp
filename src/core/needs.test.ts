import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { PlanStatus } from '../types/index';
import {
  checkNeedsForRun,
  computeNeedsBlockedIds,
  hasBlockingNeed,
  isBlockingNeed,
  parseNeedsRef,
  resolveNeedsRefs,
} from './needs';
import { formatEntityFile } from './serialize';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProject(
  ideas: { id: string; title: string; status?: PlanStatus }[],
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-needs-'));
  dirs.push(dir);
  const ideasDir = join(dir, 'papercamp', 'ideas');
  await mkdir(ideasDir, { recursive: true });
  for (const idea of ideas) {
    const content = formatEntityFile({
      id: idea.id,
      title: idea.title,
      status: idea.status ?? 'idea',
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
      { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false, title: 'Local idea' },
      { raw: 'IDEA-99', id: 'IDEA-99', found: false },
    ]);
  });

  it('reports a found need as done once its status is done', async () => {
    const root = await makeProject([{ id: 'IDEA-1', title: 'Local idea', status: 'done' }]);
    const result = await resolveNeedsRefs(root, ['IDEA-1'], { version: 1, projects: [] });
    expect(result).toEqual([
      { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: true, title: 'Local idea' },
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
    expect(result).toEqual([
      {
        raw: 'paper-ui/IDEA-14',
        id: 'IDEA-14',
        projectSlug: 'paper-ui',
        found: true,
        done: false,
        title: 'Other project idea',
        projectName: 'paper-ui',
      },
    ]);
  });

  it('reports an unregistered project slug as unresolved rather than throwing', async () => {
    const root = await makeProject([]);
    const result = await resolveNeedsRefs(root, ['missing-project/IDEA-1'], {
      version: 1,
      projects: [],
    });
    expect(result).toEqual([
      { raw: 'missing-project/IDEA-1', id: 'IDEA-1', projectSlug: 'missing-project', found: false },
    ]);
  });
});

describe('isBlockingNeed / hasBlockingNeed', () => {
  it('blocks on a found, not-done need but not on an unresolved ref', () => {
    expect(isBlockingNeed({ raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false })).toBe(true);
    expect(isBlockingNeed({ raw: 'IDEA-1', id: 'IDEA-1', found: true, done: true })).toBe(false);
    expect(isBlockingNeed({ raw: 'IDEA-1', id: 'IDEA-1', found: false })).toBe(false);
  });

  it('hasBlockingNeed is false for undefined and for an all-done/unresolved list', () => {
    expect(hasBlockingNeed(undefined)).toBe(false);
    expect(
      hasBlockingNeed([
        { raw: 'IDEA-1', id: 'IDEA-1', found: true, done: true },
        { raw: 'IDEA-2', id: 'IDEA-2', found: false },
      ]),
    ).toBe(false);
    expect(hasBlockingNeed([{ raw: 'IDEA-1', id: 'IDEA-1', found: true, done: false }])).toBe(true);
  });
});

describe('checkNeedsForRun', () => {
  it('refuses with the blocking need, naming the project for a cross-project ref', async () => {
    const root = await makeProject([{ id: 'IDEA-2', title: 'Still open' }]);
    const message = await checkNeedsForRun(root, ['IDEA-2']);
    expect(message).toBe('waits for IDEA-2');
  });

  it('does not block on a done need or an unresolved ref', async () => {
    const root = await makeProject([{ id: 'IDEA-2', title: 'Done already', status: 'done' }]);
    expect(await checkNeedsForRun(root, ['IDEA-2'])).toBeNull();
    expect(await checkNeedsForRun(root, ['IDEA-404'])).toBeNull();
    expect(await checkNeedsForRun(root, [])).toBeNull();
  });
});

describe('computeNeedsBlockedIds', () => {
  it('collects only the ids whose needs are unmet', async () => {
    const root = await makeProject([
      { id: 'IDEA-1', title: 'Waits on open work' },
      { id: 'IDEA-2', title: 'Still open' },
      { id: 'IDEA-3', title: 'No needs' },
    ]);
    const blocked = await computeNeedsBlockedIds(root, [
      { id: 'IDEA-1', needs: ['IDEA-2'] },
      { id: 'IDEA-2', needs: [] },
      { id: 'IDEA-3', needs: [] },
    ]);
    expect(blocked).toEqual(new Set(['IDEA-1']));
  });
});
