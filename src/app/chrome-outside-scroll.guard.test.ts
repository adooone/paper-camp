import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// IDEA-155: only the content scroll container may scroll — header, toolbar,
// and the mobile bottom nav must stay outside it so they never scroll away.
// Static source check (no jsdom/browser here) rather than a DOM measurement.
const ROUTER_PATH = join(dirname(fileURLToPath(import.meta.url)), 'router.tsx');

function findMatchingDivClose(source: string, openTagStart: number): number {
  const tagRe = /<div\b[^>]*?(\/)?>|<\/div>/g;
  tagRe.lastIndex = openTagStart;
  let depth = 0;
  for (let match = tagRe.exec(source); match; match = tagRe.exec(source)) {
    const isSelfClosing = match[0].endsWith('/>');
    const isClose = match[0] === '</div>';
    if (isClose) {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }
  throw new Error('unbalanced <div> tags while scanning router.tsx');
}

describe('chrome stays outside the scroll container (IDEA-155)', () => {
  const source = readFileSync(ROUTER_PATH, 'utf8');

  const scrollMarker = source.indexOf('[scrollbar-gutter:stable]');
  const scrollDivOpen = source.lastIndexOf('<div', scrollMarker);
  const scrollDivClose = findMatchingDivClose(source, scrollDivOpen);

  it('finds the content scroll container', () => {
    expect(scrollMarker).toBeGreaterThan(-1);
    expect(scrollDivOpen).toBeGreaterThan(-1);
  });

  it('renders the header and toolbar chrome before the scroll container opens', () => {
    expect(source.indexOf('<ServerReloadBanner')).toBeGreaterThan(-1);
    expect(source.indexOf('<ServerReloadBanner')).toBeLessThan(scrollDivOpen);
    expect(source.indexOf('<StatusBar')).toBeGreaterThan(-1);
    expect(source.indexOf('<StatusBar')).toBeLessThan(scrollDivOpen);
  });

  it('renders the stack panel and mobile bottom nav after the scroll container closes', () => {
    expect(source.indexOf('<StackPanel')).toBeGreaterThan(scrollDivClose);
    expect(source.lastIndexOf('aria-label="Main navigation"')).toBeGreaterThan(scrollDivClose);
  });
});
