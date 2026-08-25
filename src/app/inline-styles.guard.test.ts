import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// IDEA-112: the app is styled with Tailwind utility classes, not inline `style={{}}`.
// This guard fails the "Tests" check (which run-all gates on) if any static inline
// style slips in, so an incomplete migration or a later regression can't pass green.
//
// A file may opt out ONLY for genuinely dynamic values that can't be a class — a
// colour/size computed from data at render time. Add it here with a one-line reason.
const DYNAMIC_STYLE_ALLOWLIST = new Set([
  'features/roadmap/views/progress-bar.tsx', // progress-bar fill width computed from rollup data
  'features/roadmap/roadmap-sidebar.tsx', // status-dot colour from STATUS_STAMP
  'components/stack-panel/stack-panel.tsx', // open/closed slide toggled via `transform`
  'features/plans/views/plan-filter-column.tsx', // status-dot colour from STATUS_STAMP
  'router.tsx', // paper-ui's Layout has no className prop, only style
  'components/shell/status-bar-core.tsx', // paper-ui's getTextureStyles() has no className form
  'features/plans/views/phases-section.tsx', // running-phase fill fraction via --phase-fill CSS var
]);

const APP_DIR = dirname(fileURLToPath(import.meta.url));

function jsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsxFiles(full));
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) out.push(full);
  }
  return out;
}

describe('no inline styles (IDEA-112)', () => {
  it('src/app uses Tailwind classes, not inline style={...} (except allowlisted dynamic files)', () => {
    const offenders = jsxFiles(APP_DIR)
      .filter((f) => /\bstyle\s*=/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(APP_DIR, f))
      .filter((rel) => !DYNAMIC_STYLE_ALLOWLIST.has(rel))
      .sort();
    expect(offenders).toEqual([]);
  });
});
