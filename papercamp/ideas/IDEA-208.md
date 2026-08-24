---
id: IDEA-208
title: Hub feature conventions pass
type: refactor
status: planned
created: 2026-08-24
updated: 2026-08-24
tags:
  - app
  - code-health
  - multi-project
subject: Code health
---

[[IDEA-198]]'s conventions pass applied to `src/app/features/hub` — the newest
feature (from [[IDEA-205]]), 19 files, 793 lines, and the furthest from the §4
template because it grew fast: screens, cards, hooks and helpers all sit loose
at the root or inside `cross-project/`, a domain folder where the feature
template wants by-role ones.

Measured violations (the §8 audit checklist):

- Four hooks outside `hooks/`: `use-runtime-statuses.ts` at the root and
  `use-cross-project-{activity,ideas,reviews}.ts` inside `cross-project/` (§4).
- Inline props type literals in `projects-list.tsx` and
  `github-connect-card.tsx` (§5).
- Duplicate import statements in `github-connect-card.tsx`
  (`@/app/services/github/identity` twice) and `cross-project/activity-view.tsx`
  (`@dendelion/paper-ui` twice) (§5).
- `cross-project/fan-out.test.ts` sits beside its subject instead of in a
  `__tests__/` subfolder (§4).

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm lint`
and `npx vitest run` green and no test edited to accommodate it.

### Out of scope

Behaviour. Any change to paper-ui. The other features' passes.

### Phases
- [x] Gather every hook into hooks/
      Move `use-runtime-statuses.ts` and the three `cross-project/use-cross-project-*.ts` hooks into `hooks/` with an `index.ts` barrel; consumers import through the barrel.
      run: 3m26s · 38 in · 3.9k out · sonnet-5
- [x] Sort the rest into by-role folders
      Apply the §4 template, dissolving `cross-project/`: `hub-shell.tsx` and `index.ts` stay as anchors; screens and views (`hub-home`, `welcome-screen`, `projects-list`, the three `*-view` files) into `views/`; cards (`github-connect-card`, `add-runtime-card`) into `components/`; `rename-runtime-button.tsx` into `actions/`; pure logic (`fan-out.ts`, `project-label.ts`, `open-in-project.ts`) into `helpers/` with `fan-out.test.ts` in `helpers/__tests__/`.
      run: 4m35s · 74 in · 9k out · sonnet-5
- [ ] Name props interfaces and merge duplicate imports
      Convert the inline props literals in `projects-list.tsx` and `github-connect-card.tsx` to `{Component}Props` interfaces, and collapse the two duplicated import statements (§5).
