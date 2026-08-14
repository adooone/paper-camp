import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readReviewedShas, recordReviewedSha } from './pr-review-state';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-pr-review-state-'));
  mkdirSync(join(root, 'papercamp'), { recursive: true });
  roots.push(root);
  return root;
}

describe('readReviewedShas', () => {
  it('resolves an empty object when no state file exists yet', async () => {
    const root = makeRoot();
    expect(await readReviewedShas(root)).toEqual({});
  });

  it('resolves an empty object when the state file is corrupt', async () => {
    const root = makeRoot();
    writeFileSync(join(root, 'papercamp', 'pr-reviews.json'), 'not json');
    expect(await readReviewedShas(root)).toEqual({});
  });
});

describe('recordReviewedSha', () => {
  it('persists a SHA that a later read sees, surviving a fresh read (restart)', async () => {
    const root = makeRoot();
    await recordReviewedSha(root, 'IDEA-1', 'abc123');
    expect(await readReviewedShas(root)).toEqual({ 'IDEA-1': 'abc123' });
  });

  it('overwrites the prior SHA for the same entity without touching others', async () => {
    const root = makeRoot();
    await recordReviewedSha(root, 'IDEA-1', 'abc123');
    await recordReviewedSha(root, 'IDEA-2', 'def456');
    await recordReviewedSha(root, 'IDEA-1', 'newsha');
    expect(await readReviewedShas(root)).toEqual({ 'IDEA-1': 'newsha', 'IDEA-2': 'def456' });
  });
});
