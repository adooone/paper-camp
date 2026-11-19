import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { UserConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import { nextBasepath, nextEntryFallback } from './entry-path';

const repoRoot = resolve(import.meta.dirname, '../..');

const entries = [
  { name: 'main', html: 'index.html', script: '/src/app/main.tsx' },
  { name: 'next', html: 'next/index.html', script: '/src/next/main.tsx' },
];

interface Rewrite {
  source: string;
  destination: string;
}

const rewrites = (
  JSON.parse(readFileSync(resolve(repoRoot, 'vercel.json'), 'utf-8')) as { rewrites: Rewrite[] }
).rewrites;

function vercelDestination(pathname: string): string | undefined {
  return rewrites.find((rewrite) => new RegExp(`^${rewrite.source}$`).test(pathname))?.destination;
}

describe('the two desk entries', () => {
  it.each(entries)('$html mounts $script on #root', ({ html, script }) => {
    const markup = readFileSync(resolve(repoRoot, html), 'utf-8');
    expect(markup).toContain('<div id="root"');
    expect(markup).toContain(`src="${script}"`);
    expect(existsSync(resolve(repoRoot, script.slice(1)))).toBe(true);
  });

  it('builds both html files as rollup inputs', async () => {
    const configPath = resolve(repoRoot, 'vite.app.config.ts');
    const appConfig = ((await import(configPath)) as { default: UserConfig }).default;
    const input = appConfig.build?.rolldownOptions?.input as Record<string, string>;
    expect(Object.keys(input).sort()).toEqual(entries.map((entry) => entry.name).sort());
    for (const entry of entries) expect(input[entry.name]).toBe(resolve(repoRoot, entry.html));
  });

  it.each([
    ['/next', '/next/index.html'],
    ['/next/', '/next/index.html'],
    ['/next/ui', '/next/index.html'],
    ['/next/ideas/IDEA-3', '/next/index.html'],
    ['/', '/index.html'],
    ['/ideas/IDEA-3', '/index.html'],
    ['/nextcloud', '/index.html'],
  ])('Vercel serves %s from %s', (pathname, destination) => {
    expect(vercelDestination(pathname)).toBe(destination);
  });

  it('leaves built assets to the filesystem on Vercel', () => {
    expect(vercelDestination('/assets/next-abc.js')).toBeUndefined();
  });
});

describe('nextEntryFallback', () => {
  it.each(['/next', '/next/', '/next/ui', '/next/ideas/IDEA-3'])(
    'sends %s to the second entry',
    (pathname) => {
      expect(nextEntryFallback(pathname)).toBe('/next/index.html');
    },
  );

  it.each(['/', '/ideas/IDEA-3', '/nextcloud', '/next/index.html', '/next/sw.js'])(
    'leaves %s to the first entry or the file it names',
    (pathname) => {
      expect(nextEntryFallback(pathname)).toBeNull();
    },
  );
});

describe('nextBasepath', () => {
  it('sits under the mount prefix', () => {
    expect(nextBasepath('')).toBe('/next');
    expect(nextBasepath('/p/paper-camp')).toBe('/p/paper-camp/next');
  });
});
