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

function writeRunOrder(root: string, lines: string[]): void {
  writeFileSync(
    join(root, 'papercamp', 'run-order.md'),
    lines.length ? `${lines.join('\n')}\n` : '',
  );
}

function readRunOrder(root: string): string[] {
  const raw = (() => {
    try {
      return readFileSync(join(root, 'papercamp', 'run-order.md'), 'utf-8');
    } catch {
      return '';
    }
  })();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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
      phases: [{ text: 'One', done: false }],
    });
    // No status stored — derives to `planned` purely because it now has phases,
    // simulating a draft-plan agent writing phases directly to disk.
    write(root, {
      id: 'IDEA-2',
      title: 'Grew phases out-of-band',
      type: 'feat',
      created: '2026-07-02',
      phases: [{ text: 'One', done: false }],
    });
    writeRunOrder(root, ['IDEA-1 — Already ordered']);

    const changed = await runRunOrderPass(root);

    expect(changed.sort()).toEqual(['IDEA-2']);
    expect(readRunOrder(root)).toEqual([
      'IDEA-1 — Already ordered',
      'IDEA-2 — Grew phases out-of-band',
    ]);
  });

  it('leaves a matching ordering untouched', async () => {
    const root = tmpRoot();
    write(root, {
      id: 'IDEA-1',
      title: 'First',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-01',
      phases: [{ text: 'One', done: false }],
    });
    write(root, {
      id: 'IDEA-2',
      title: 'Second',
      type: 'feat',
      status: 'planned',
      created: '2026-07-02',
      phases: [{ text: 'One', done: false }],
    });
    writeRunOrder(root, ['IDEA-1 — First', 'IDEA-2 — Second']);

    const changed = await runRunOrderPass(root);

    expect(changed).toEqual([]);
    expect(readRunOrder(root)).toEqual(['IDEA-1 — First', 'IDEA-2 — Second']);
  });
});
