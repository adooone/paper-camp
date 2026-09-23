---
id: IDEA-279
title: Adopt paper-ui's tokens and defaults
type: refactor
status: idea
created: 2026-09-22
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 1
---

paper-ui's IDEA-3 makes this app's choices the library's defaults and
exports what this app copies. Once it ships, everything here that
existed to override or mirror paper-ui is deleted. Blocked until
`@dendelion/paper-ui` releases with IDEA-3; the first phase bumps the
dependency.

**`tokens.ts` goes.** Every `color.*` and `surface.*` import resolves to
`@dendelion/paper-ui/tokens`. The `desk`, `chalk` and `state` colour
tables in `tailwind.config.ts` come from the same export.

**Raw colours go.** `STATUS_STAMP`, `IDEA_STATUS_STAMP`, `PR_STATE_STAMP`
and `REVIEW_DECISION_STAMP` in `features/plans/constants.ts` become maps
to `StampVariant` — `review`, `dropped`, `idea`, `muted`, `faint` and the
five that existed — and every `fillColor`/`textColor` on a `Stamp` goes
with them, chalkboard ones through `surface="chalkboard"`. The six hex
literals, twenty rgba fills, the merged-PR purple in `plan-rows.tsx`, the
highlight outline in `roadmap/constants.ts` and its two inline copies all
resolve to tokens.

**The stylesheet loses its overrides.** The `--pui-btn-*` block, the
`--paper-font-default` flip, the global 600-weight rule, the `Layout`
header height and background overrides and the nested-fold chevron pin
are deleted; `AppShell` passes `headerHeight={64}` and
`headerBackground="none"`. `charts/rough-generator.ts` and every
`Math.random()` seed give way to the exported `roughGenerator` and
`useStableSeed`.

### Out of scope

Replacing any component; that is [[IDEA-280]] to [[IDEA-283]].

### Phases
- [x] Bump `@dendelion/paper-ui` to the release carrying IDEA-3
      Blocking prerequisite; nothing below can land until the export surface exists.
      run: 2m35s · 42 in · 4.8k out · sonnet-5 · sess:ca5a37b9-514d-43ad-a188-832b75cab98f
- [x] Delete `tokens.ts` and repoint `color.*`/`surface.*` at the package
      Includes the `desk`, `chalk` and `state` tables in `tailwind.config.ts`.
      run: 4m16s · 106 in · 23.2k out · sonnet-5 · sess:ca5a37b9-514d-43ad-a188-832b75cab98f
- [x] Map the four stamp constants to `StampVariant`
      Drop every `fillColor`/`textColor` prop, moving chalkboard stamps to `surface="chalkboard"`.
      run: 4m11s · 104 in · 21.8k out · sonnet-5 · sess:ca5a37b9-514d-43ad-a188-832b75cab98f
- [x] Resolve the remaining hex, rgba and outline literals to tokens
      run: 12m15s · 194 in · 46.3k out · sonnet-5 · sess:c0ad23e9-69e1-4ab8-9800-e1f8718e0e07
- [ ] Strip the stylesheet overrides and adopt the exported rough helpers
      Covers the `AppShell` header props, `roughGenerator` and `useStableSeed`.
