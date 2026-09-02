---
id: IDEA-226
title: Read paper-ui source from node_modules
type: docs
status: in-progress
created: 2026-09-01
tags:
  - docs
  - code-health
subject: Code health
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
- [ ] Ship `src/components` from paper-ui
      Sibling repo: add it to the `files` array with a changeset, publish, then bump the range here — carried out per `AGENTS.md`'s paper-ui publishing steps.
- [ ] Simplify the convention to the published path
      Once the sources ship directly, `AGENTS.md` names `node_modules/@dendelion/paper-ui/src/components/` and drops the source-map route.
- [ ] Verify a phase runs clean under opencode
      Run a phase touching a paper-ui component with opencode and confirm no external-directory prompt and no parked run.

### Thread
- [x] 2026-09-01 [log] [agent] Applied phase 1 out of band: the run-all for [[IDEA-223]] failed twice on this exact denial (`read outside workspace: .../page/page.tsx`, then `.../modal/modal.tsx`), so the convention fix went in immediately rather than waiting to be scheduled. Added `scripts/paper-ui-source.mjs` — the raw source map is a megabyte of JSON, so an instruction to read it directly would not have been followable; the script prints a component's original `.tsx` by name and lists them with no argument. `AGENTS.md` now points there and says explicitly not to read the sibling checkout for this. `knip.json` gained `scripts/*.mjs` as an entry pattern, same fix the Vercel `api/` functions needed.
- [x] 2026-09-01 [note] [agent] `docs/CODE_STYLE.md` still cites `~/dev/paper-ui/src/components/button/button.module.scss` as provenance for button theming. Left as-is: SCSS module contents are genuinely absent from the source map, so there is no in-workspace copy to point at, and it reads as a citation rather than an instruction to open the file.
