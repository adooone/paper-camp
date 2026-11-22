import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Content blockers on EasyPrivacy refuse module URLs with a `log` segment or a `log-*` name, which breaks the dev client.
const SRC = dirname(fileURLToPath(import.meta.url));
const SERVED = ['app', 'next', 'toolbar'];
const SERVER_ONLY = join(SRC, 'app', 'server');
const BLOCKED = /(^|\/)log(\/|[-.])/;

function files(dir: string): string[] {
  if (dir === SERVER_ONLY) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

describe('served module paths', () => {
  it('never contain a log segment or a log-* file name', () => {
    const offenders = SERVED.flatMap((root) => files(join(SRC, root)))
      .map((file) => relative(SRC, file))
      .filter((path) => BLOCKED.test(path));
    expect(offenders).toEqual([]);
  });
});
