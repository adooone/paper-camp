---
id: IDEA-262
title: Init scaffolds the agent allowlist
type: fix
status: done
created: 2026-09-12
updated: 2026-09-12
tags:
  - cli
  - core
subject: Packaging
order: 4
---

`paper-camp init` writes `.claude/settings.json` with a SessionStart hook
and nothing else. A headless phase run uses `--permission-mode auto`, so
in a fresh project every edit outside the defaults and every shell
command is denied, and the run parks as a "question" whose text is the
denied command. paper-ui's IDEA-1 parked twice on 2026-09-11 on
`pnpm run tokens:check`; paper-camp-mobile's IDEA-1 parked on
2026-09-12 on `npm pack`. Both were unblocked by hand-writing the
allowlist paper-camp's own repo has carried since FEAT-10. The hook
`init` writes also calls `$CLAUDE_PROJECT_DIR/node_modules/.bin/paper-camp`,
which exists only in a repo that depends on the package; every other
project's hook fails silently.

**Init writes the allowlist.** `initProject` in `scaffold.ts` writes a
`permissions.allow` list beside the hook: edits and writes under `src/**`,
`app/**`, `scripts/**`, `papercamp/**`, and `*.json`, `*.ts`, `*.tsx`,
`*.md`, `*.config.*` at the root; read-only git (`status`, `diff`,
`log`); `ls`, `cat`, and `wc`; and the detected package manager's
`run`, `test`, `install`, `view`, `pack`, and `ls` forms — `pnpm run *`
for a pnpm lockfile, `npm run *` for npm, `yarn`/`bun` likewise — plus
`npx tsc*`, `npx biome check*`, `npx vitest*`, `npx jest*`, and
`npx expo *`. An existing `settings.json` is merged, never replaced:
entries already present are kept, the list is appended, and a file the
user has edited by hand keeps its hook.

**The hook calls the global command.** The SessionStart hook becomes
`paper-camp session-focus`, the same command every other CLI path uses,
with the `node_modules` form used only when `@dendelion/paper-camp` is a
dependency of the project.

**Existing projects catch up.** `paper-camp doctor` reports a project
whose `settings.json` has no `permissions.allow` as a warning naming the
fix, and `paper-camp init` in an initialised project — today an error —
offers `--settings` to write the allowlist and hook alone.

### Out of scope

Per-project tuning of the list; a project edits the file. Any change to
how the daemon launches agents.

### Phases
- [x] Generate the allowlist and the hook command
      Detect the package manager from the lockfile and build both the
      `permissions.allow` list and the SessionStart command in `templates.ts`.
      run: 1m35s · 32 in · 8k out · sonnet-5 · sess:02dfa4bf-2bce-4aa2-9cee-5fa07d05c2c6
- [x] Merge an existing settings.json instead of skipping it
      `initProject` appends only the missing entries and leaves the user's
      hook and edits intact.
      run: 1m18s · 26 in · 6.2k out · sonnet-5 · sess:02dfa4bf-2bce-4aa2-9cee-5fa07d05c2c6
- [x] Offer `paper-camp init --settings` in an initialised project
      run: 56s · 26 in · 4.5k out · sonnet-5 · sess:02dfa4bf-2bce-4aa2-9cee-5fa07d05c2c6
- [x] Warn in `paper-camp doctor` when `permissions.allow` is absent
      run: 1m37s · 40 in · 7.9k out · sonnet-5 · sess:02dfa4bf-2bce-4aa2-9cee-5fa07d05c2c6
- [x] Cover detection, merging, and both commands in tests
      run: 2m27s · 60 in · 11.9k out · sonnet-5 · sess:02dfa4bf-2bce-4aa2-9cee-5fa07d05c2c6
