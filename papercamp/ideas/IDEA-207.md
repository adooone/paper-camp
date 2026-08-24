---
id: IDEA-207
title: Git feature conventions pass
type: refactor
status: in-progress
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - git
subject: Code health
order: 1
---

The `docs/CODE_STYLE.md` conventions pass [[IDEA-198]] ran over the plans
feature, applied to `src/app/features/git`. The feature is 8 files, 580 lines,
all loose at the feature root — no by-role folders at all, right at §4's soft
ceiling once the hook extraction below adds files.

Measured violations (the §8 audit checklist):

- `git-commit-controls.tsx` exports a hook from a components file (§4: hooks
  live in `hooks/`) and declares its props as an inline type literal (§5).
- `git-page.tsx` and `git-file-list.tsx` each hold 4 `useAppStore` selectors
  plus state/effects — page wiring stapled to rendering (§4: components render,
  hooks decide). `git-file-list.tsx` also carries the bulk stage/unstage
  fan-out handler inline.
- 18 comment lines across the feature to audit against §7's three bars — most
  look like legitimate one/two-line whys, but each gets checked, not
  grandfathered.

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. The other features — each has its own pass
([[IDEA-208]]–[[IDEA-215]]).

### Phases
- [x] Move the hook out of git-commit-controls
      Relocate the hook exported by `git-commit-controls.tsx` to `hooks/use-*.ts`, and convert that component's inline props literal to a named `{Component}Props` interface (§5).
      run: 4m · 6.2k in · 5.2k out · sonnet-5
- [x] Extract page wiring into feature hooks
      Give `git-page.tsx` and `git-file-list.tsx` one `hooks/` hook each that owns their store selectors, state, effects and async handlers (including the stage/unstage fan-out); the components consume what the hooks return.
      run: 2m34s · 20 in · 1.9k out · sonnet-5
- [ ] Sort files into by-role folders
      Apply the §4 feature template: `git-page.tsx` and `index.ts` stay as anchors; views into `views/`, small atoms (`git-status-marker.tsx`, `file-path.tsx`, `count-badge.tsx`) into `components/`, each folder with an `index.ts` barrel and consumers importing through it.
- [ ] Audit every comment against §7
      Walk the 18 `//` lines: keep a one/two-line non-derivable why, delete everything else. No new comments are added to compensate.

### Thread
- [ ] 2026-08-24 [question] [agent] Run-all parked on phase 2 ("Extract page wiring into feature hooks") — the agent needs a decision: Not logged in · Please run /login
