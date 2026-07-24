import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache } from '../../core/git-pr/pr';
import { formatEntityFile } from '../../core/serialize/serializer';
import { runRunOrderPass } from './run-order-pass';

const originalPath = process.env.PATH;

/** Puts a fake `gh` on PATH that exits non-zero, so status derives from stored fields alone. */
function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-run-order-pass-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

function tmpRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-root-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function write(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

function readOrder(root: string, id: string): number | undefined {
  const raw = readFileSync(join(root, 'papercamp', 'ideas', `${id}.md`), 'utf-8');
  const match = raw.match(/^order: (\d+)$/m);
  return match ? Number(match[1]) : undefined;
}

describe('runRunOrderPass', () => {
  it('gives an entity that gained phases out-of-band an order within one pass', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'Already ordered',
      type: 'feat',
      status: 'planned',
      created: '2026-07-01',
      order: 1,
      phases: [{ text: 'One', done: false }],
    });
    // No status/order stored — derives to `planned` purely because it now has phases,
    // simulating a draft-plan agent writing phases directly to disk.
    write(root, {
      id: 'IDEA-2',
      title: 'Grew phases out-of-band',
      type: 'feat',
      created: '2026-07-02',
      phases: [{ text: 'One', done: false }],
    });

    const changed = await runRunOrderPass(root);

    expect(changed.sort()).toEqual(['IDEA-2']);
    expect(readOrder(root, 'IDEA-1')).toBe(1);
    expect(readOrder(root, 'IDEA-2')).toBe(2);
  });

  it('leaves a PATCH-created ordering untouched', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-01',
      order: 1,
      phases: [{ text: 'One', done: false }],
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
      order: 2,
      phases: [{ text: 'One', done: false }],
    });

    const changed = await runRunOrderPass(root);

    expect(changed).toEqual([]);
    expect(readOrder(root, 'IDEA-1')).toBe(1);
    expect(readOrder(root, 'IDEA-2')).toBe(2);
  });
});
