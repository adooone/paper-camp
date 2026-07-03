/**
 * Architectural consistency rules for paper-camp. Enforces the layering the repo
 * already documents (core/cli are independent of the dashboard app) and forbids
 * cycles / deep relative imports. Run via `pnpm run depcruise`.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      // Warning, not error: one known cycle exists today (docs-api ↔ app-store,
      // already broken at runtime via a dynamic import). Kept visible so no NEW
      // cycles creep in; promote to 'error' once that one is refactored out.
      severity: 'warn',
      comment: 'Circular dependencies make modules hard to test and reason about.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment: 'An import that cannot be resolved is almost always a bug or a bad path.',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'core-types-independent-of-app-and-cli',
      severity: 'error',
      comment:
        'The core library and shared types must not import from the app or cli layers — ' +
        'they are the foundation everything else builds on. (The cli deliberately reuses ' +
        'app/server code, so cli → app is allowed.)',
      from: { path: '^src/(core|types)/' },
      to: { path: '^src/(app|cli)/' },
    },
    {
      name: 'no-deep-relative-imports',
      severity: 'error',
      comment:
        'Avoid ../../ climbing more than one level — use the @/ alias instead ' +
        '(matches the repo import convention).',
      from: { path: '^src/' },
      to: { path: '(^|/)\\.\\./\\.\\./' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
