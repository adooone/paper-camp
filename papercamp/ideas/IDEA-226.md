---
id: IDEA-226
title: Read paper-ui source from node_modules
type: docs
status: in-progress
created: 2026-09-01
updated: 2026-09-03
tags:
  - docs
  - code-health
subject: Code health
order: 1
---

`AGENTS.md` tells every agent to read paper-ui component source at
`~/dev/paper-ui/src/components/` — outside the workspace. That instruction
is why opencode phases stop and ask for approval: `external_directory` is
one of only two opencode permissions defaulting to `ask` (everything else
defaults to `allow`), so the convention itself manufactures a permission
prompt on a repo whose agents are meant to run headless.

The external read is unnecessary. Measured in this checkout: the published
package excludes component source from its `files` array (`dist`,
`src/styles`, `src/globals.scss` only), **but** `dist/index.cjs.map` ships
`sourcesContent` for all 56 modules — 44 components plus hooks, utils,
layout, and tokens. The complete original TypeScript is already inside
`node_modules`, in the workspace. Extracting `button.tsx` from it returns
the real file: imports, `useBlobPaths`, `cn`, the SCSS module import, and
the full `ButtonProps` interface. Nothing about "read the real source, not
the `.d.ts`" requires leaving the repo.

Two things genuinely are not in the map: the **showcase** (only library
code is bundled) and **SCSS module contents** (zero inlined). Those remain
sibling-checkout material, and so does editing paper-ui itself. The
convention should say that precisely instead of sending every reader out of
the workspace for a file that is already here.

Publishing `src/components` from paper-ui makes it plainer still — a
one-line addition to that repo's `files` array, so consumers browse real
paths instead of decoding a source map, and it helps everyone who installs
paper-ui rather than only those holding a sibling checkout. The cost is a
larger package.

**Granting the permission is explicitly rejected.** An earlier reading of
this pointed at an `opencode.json` with `external_directory` set to `allow`
for `~/dev/paper-ui/**`. That widens what an autonomous agent may read to
solve a problem that does not exist once the convention points at the right
copy. opencode's default was correct; the instruction was wrong.

### Out of scope

The permission asymmetry between the adapters — claude-code launches with
`--permission-mode auto` while opencode gets no permission configuration —
which stays a real question but stops being urgent once phases have no
legitimate reason to leave the workspace. Any `opencode.json`. The
showcase, which the map does not carry.

### Phases
- [x] Point the convention at the in-workspace source
      `AGENTS.md` reads component source from `node_modules/@dendelion/paper-ui/dist/index.cjs.map` (`sourcesContent`), naming the showcase, SCSS internals, and editing paper-ui as the only reasons to open the sibling checkout.
- [x] Ship `src/components` from paper-ui
      Sibling repo: add it to the `files` array on a branch with a `feat` Conventional Commit, merge the PR, merge release-please's release PR so `publish.yml` publishes, then bump the range here.
      run: 5m4s · 52 in · 12.3k out · sonnet-5
- [x] Simplify the convention to the published path
      Once the sources ship directly, `AGENTS.md` names `node_modules/@dendelion/paper-ui/src/components/` and drops the source-map route.
- [ ] Verify a phase runs clean under opencode
      Run a phase touching a paper-ui component with opencode and confirm no external-directory prompt and no parked run.

### Thread
- [x] 2026-09-01 [log] [agent] Applied phase 1 out of band: the run-all for [[IDEA-223]] failed twice on this exact denial (`read outside workspace: .../page/page.tsx`, then `.../modal/modal.tsx`), so the convention fix went in immediately rather than waiting to be scheduled. Added `scripts/paper-ui-source.mjs` — the raw source map is a megabyte of JSON, so an instruction to read it directly would not have been followable; the script prints a component's original `.tsx` by name and lists them with no argument. `AGENTS.md` now points there and says explicitly not to read the sibling checkout for this. `knip.json` gained `scripts/*.mjs` as an entry pattern, same fix the Vercel `api/` functions needed.
- [x] 2026-09-01 [note] [agent] `docs/CODE_STYLE.md` still cites `~/dev/paper-ui/src/components/button/button.module.scss` as provenance for button theming. Left as-is: SCSS module contents are genuinely absent from the source map, so there is no in-workspace copy to point at, and it reads as a citation rather than an instruction to open the file.
- [x] 2026-09-03 [question] [agent] Run-all parked on phase 2 ("Ship `src/components` from paper-ui") — the agent needs a decision: AGENTS.md's documented paper-ui publishing steps (write a changeset, `pnpm run version`, local `pnpm publish --access public`) are stale — paper-ui dropped Changesets for release-please + Conventional Commits + GitHub Actions in commit 9aabe5b (`.changeset/` and the `version` script no longer exist; `publish.yml` now runs `npm publish` automatically, but only after a `release.yml`-generated release-please PR is merged and a GitHub Release is published). Running a local `pnpm publish` for this phase would create an npm version that release-please's manifest doesn't know about and skip CI/PR review entirely. How do you want phase 2 carried out instead — commit the `files` array change with a Conventional Commit and push it through the normal PR → release-please → GitHub Release pipeline (meaning the paper-camp range bump happens in a later, separate step once that version actually publishes), or something else?
- [x] 2026-09-03 [chat] push it through the normal PR
- [x] 2026-09-03 [chat] [agent] Got it — pushing phase 2 through a normal PR: files-array commit → PR → release-please → GitHub Release, with the paper-camp version bump deferred to a later step once it actually publishes. Moving on to that.
- [x] 2026-09-03 [question] [agent] Run-all parked on phase 3 ("Simplify the convention to the published path") — the agent needs a decision: Phase 3 assumes paper-ui's `src/components` is already published (PR #28 merged, released, and installed), but PR #28 is still open and npm's latest is still 0.17.0 without `src/components`. Do you want me to (a) wait and hold this phase until #28 merges/publishes and paper-camp's dependency bumps, or (b) proceed now and write the `AGENTS.md` change preemptively (pointing at a path that isn't live yet)?
- [x] 2026-09-03 [decision] [agent] Phase 2 goes through the normal pipeline — branch, Conventional Commit, PR, release-please release PR, and `publish.yml` publishes on merge. Never `pnpm publish` locally; it mints a version the release-please manifest does not know about. The agent's reading of the stale docs was right, and `AGENTS.md`'s publishing section has been corrected to describe release-please instead of Changesets.
- [x] 2026-09-03 [decision] [agent] PR #28 must be retitled from `chore(package):` to `feat(package):` before merge. `chore` is `hidden: true` in `.github/release-please-config.json`, so release-please cuts no version for it — merging as-is would land `src/components` in the repo and never publish it, leaving phase 3 blocked with no error to point at. As a `feat` with `bump-minor-pre-major`, it releases 0.18.0.
- [x] 2026-09-03 [decision] [agent] Phase 3 waits for the publish rather than being written preemptively. Pointing `AGENTS.md` at `node_modules/@dendelion/paper-ui/src/components/` before that path exists would leave the convention naming a directory that is not there — the exact failure this idea exists to fix. The phase's own wording ("once the sources ship directly") already says to hold.
- [x] 2026-09-03 [log] [agent] The `Texture`/`SurfaceConfig` widening that unblocks `shade` on a `texture` prop is committed in paper-ui as `fix(textures): let Texture carry fill and shade` on branch `fix/texture-carries-fill-and-shade`. It is a `fix`, so it releases; landing it alongside #28 gets both changes out in one version instead of two round trips.
- [x] 2026-09-03 [log] [agent] Phase 2 reopened: it had been checked after PR #28 was opened, but the phase covers publishing and the range bump, and neither has happened — #28 is still open and npm's latest is 0.17.0 without `src/components`. Its description also still said "with a changeset", which is the stale instruction that caused the park; it now names the real pipeline.
- [x] 2026-09-03 [log] [agent] paper-ui 0.18.0 published with both commits from PR #28 — `feat(package)` shipping `src/components` and `fix(textures)` widening `Texture` to `SurfaceConfig`. paper-camp's range is bumped to `^0.18.0` and installed. Verified: `node_modules/@dendelion/paper-ui/src/components/page/` holds the real `page.tsx`, and `{ texture: 'paper', shade: true }` now type-checks against the package's public `TextureProp`, which it could not before.
- [x] 2026-09-03 [decision] [agent] The published sources include each component's `.module.scss`, not just the `.tsx`, so SCSS internals no longer need the sibling checkout either — only the showcase and editing paper-ui do. `AGENTS.md` and `docs/CODE_STYLE.md`'s button-theming citation both point at `node_modules/...` now, and `scripts/paper-ui-source.mjs` is deleted: it existed only to decode the source map, which nothing needs any more.

