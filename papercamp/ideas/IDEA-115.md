---
id: IDEA-115
title: npm package is broken on Linux — bundled node-pty can't load
type: fix
status: planned
created: 2026-08-04
tags:
  - cli
  - packaging
---

`npx @dendelion/paper-camp init` (0.13.0) crashes immediately on Linux: `Failed to load native module: pty.node`. Found while installing paper-camp into the func-ui repo. Two stacked causes:

1. `node-pty@1.1.0` publishes prebuilds for darwin-arm64/darwin-x64/win32-arm64/win32-x64 only — Linux needs a node-gyp compile at install time, which pnpm 10's build-script allowlist silently blocks in consumer repos (`pnpm.onlyBuiltDependencies` won't include node-pty).
2. Fatally, the CLI is a Rollup bundle with node-pty inlined, and rollup's commonjs shim rejects the dynamic `require()` of any `.node` binary not registered as a `dynamicRequireTargets` entry at build time — so even a present, correctly-built `pty.node` cannot load. Symlinking prebuilds next to the bundle was tested and does not help; the shim throws before touching the filesystem.

The top-level import chain pulls node-pty in for every command, so even `init` — which needs no terminal — dies.

### Phases
- [x] Externalize node-pty from the CLI bundle (real runtime dependency, not inlined)
- [x] Lazy-import node-pty only where terminal features run, so init/dev never crash on it
- [x] Verify `npx @dendelion/paper-camp init && dev` in a fresh Linux consumer repo
- [ ] Release (workaround until then: run the CLI from a source clone with bun)
