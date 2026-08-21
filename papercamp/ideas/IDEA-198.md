---
id: IDEA-198
title: Plans feature conventions pass
type: refactor
status: idea
created: 2026-08-21
tags:
  - app
  - code-health
  - plans
subject: Code health
order: 5
---

Four conventions the plans feature applies inconsistently. Each is small, each
recurs in every other feature, and each becomes a rule in `docs/CODE_STYLE.md`
so the next feature inherits the answer instead of re-deciding it. [[IDEA-197]]
handles the one big file; this is everything else.

### Props are always a named interface

§5 says a component's props interface is named `{Component}Props`. The feature
declares 31 of them and then writes 11 components with an inline type literal
instead — `PhasesSection`'s is 11 fields spelled out between the parameter list
and the arrow, which is why its signature runs 22 lines. Convert all 11.

### A feature hook owns store access

Four files read the store five or more times each: `entity-detail.tsx` (10
`useAppStore` selectors), `plans-page.tsx` (9), `worklist-rows.tsx` (8),
`deliver-controls.tsx` (8). A component with ten selector subscriptions is
coupled to the store's shape, not to its own props, and cannot be rendered in a
test without a store.

Each gets one hook in `hooks/` returning the data and callbacks that component
needs. `plans-page.tsx` is the clearest: nine selectors plus two `useEffect`s
plus the route params, all of which is page wiring rather than page rendering.

### Hooks live in `hooks/`

`components/deliver-controls.tsx` is 366 lines exporting five components, two
constants, a helper, **and** `useDeliverCommitForm` — a hook, in a components
file, in a folder for UI atoms.

The hook itself is the pattern other features should copy, so it should be easy
to find: it wraps the global `useCommitForm` from `@/app/hooks` and adds only
what plans needs — the suggested commit title, the `beforeCommit` that records a
manual phase, and the failure rollback. Move it to
`hooks/use-deliver-commit-form.ts` and split the remaining components out of the
file.

### One import statement per module

Six files import the same module twice: `plans-page.tsx` pulls from `./views`
four separate times. Biome's organizer sorts imports but does not merge
duplicate sources, so this needs doing by hand and then stating as a rule.

### The colour literals are blocked, not forgotten

`constants.ts` holds 32 raw `#hex`/`rgba()` values (`STATUS_ACCENT`,
`STATUS_STAMP`, and the PR/review stamp maps) — the largest §2 violation in the
feature. **Do not fix them here.**

[[IDEA-111]] already covered this and was dropped for a reason that still holds:
the fix requires paper-ui to publish `--pui-color-*-rgb` channel tokens, the
approach was settled (store each palette entry as space-separated RGB channels
and derive both the scss token and the Tailwind colour from it), the paper-ui
code was written locally — and it was never published. paper-camp is on
paper-ui 0.17.0 today and the installed package still ships no `-rgb` token.

Reviving it means doing the cross-repo publish first. Until then `constants.ts`
stays the one sanctioned place for a colour literal in this feature, and no new
literal is added outside it.

### Out of scope

Behaviour, again — this is convention only. Splitting `entity-detail.tsx`
([[IDEA-197]]). Any change to paper-ui.

### Phases
- [ ] Name every props interface
      Replace the 11 inline props type literals with `{Component}Props` interfaces.
- [ ] Give store-heavy components a feature hook
      Extract one `hooks/` hook per component for `plans-page.tsx`, `worklist-rows.tsx`, and `deliver-controls.tsx`; leave `entity-detail.tsx` to [[IDEA-197]].
- [ ] Relocate useDeliverCommitForm and split its file
      Move the hook to `hooks/use-deliver-commit-form.ts` and break the remaining components out of `deliver-controls.tsx`.
- [ ] Merge duplicate import statements
      Collapse each module imported twice into one statement across the six files.
- [ ] Codify the conventions in docs/CODE_STYLE.md
      Add rules for named props interfaces, feature hooks owning store access, hooks living in `hooks/`, one import per module, and `constants.ts` as the only sanctioned colour literal.
