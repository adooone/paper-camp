import { type FSWatcher, watch } from 'node:fs';
import { join } from 'node:path';

const watched = new Map<string, number>();

export function isCorpusWatched(root: string): boolean {
  return (watched.get(root) ?? 0) > 0;
}

function tryWatch(
  path: string,
  recursive: boolean,
  accept: (filename: string | null) => boolean,
  onChange: () => void,
): FSWatcher | null {
  try {
    const watcher = watch(path, { recursive }, (_event, filename) => {
      if (accept(filename ? String(filename) : null)) onChange();
    });
    watcher.on('error', () => undefined);
    return watcher;
  } catch {
    return null;
  }
}

export function watchCorpus(root: string, onChange: () => void): () => void {
  const papercamp = join(root, 'papercamp');
  const git = join(root, '.git');
  const any = () => true;
  const only = (name: string) => (filename: string | null) => filename === name;
  const watchers = [
    tryWatch(join(papercamp, 'ideas'), true, any, onChange),
    tryWatch(join(papercamp, '.local'), false, only('run-order.md'), onChange),
    tryWatch(git, false, only('HEAD'), onChange),
    tryWatch(join(git, 'refs', 'heads'), true, any, onChange),
  ].filter((w): w is FSWatcher => w !== null);

  watched.set(root, (watched.get(root) ?? 0) + 1);
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    for (const w of watchers) w.close();
    const left = (watched.get(root) ?? 1) - 1;
    if (left <= 0) watched.delete(root);
    else watched.set(root, left);
  };
}
