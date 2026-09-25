---
id: IDEA-279
title: Adopt paper-ui's tokens and defaults
type: refactor
status: review
created: 2026-09-22
updated: 2026-09-24
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
- [x] Strip the stylesheet overrides and adopt the exported rough helpers
      Covers the `AppShell` header props, `roughGenerator` and `useStableSeed`.
      run: 6m47s · 182 in · 31.8k out · sonnet-5 · sess:d5eb7f17-1f6e-47fd-8acf-db55e8a126c6
- [x] [manual] Restore paper-ui token overrides and 600 weight

### Fixes
- [x] Chalkboard plates, the merge purple and the neutral chips read the old values
      Until paper-ui ships the token fixes on its IDEA-3, `shared.tsx` keeps the opaque #2d5a3b/#5a2d2d/#5a4a2d plates with #b5d6b5/#d6a0a0/#d6c4a0 text; the merged-PR purple is #7B5E9E; `PlanIdStamp`, `RowMarker`, `FeedbackThread` and `UNREACHED_STAMP` use rgba(0,0,0,.08/.06/.05) with text rgba(0,0,0,.35); the review-phase tint is rgba(155,122,181,.08); the highlight outline is rgba(200,154,90,.5); the shadows are rgba(0,0,0,…). `tailwind.config.ts` drops the dead `colors.btn` map.
      run: 49s · 30 in · 3.9k out · sonnet-5 · sess:c3345043-95f7-4bb0-9f99-6eae65afb70c
- [x] Restore the global 600 weight until paper-ui carries it
      `utilities.css` gets back `button, a, [role=button], [role=tab], [role=menuitem] { font-weight: 600 }` with a note naming the paper-ui fix that retires it; the app header, status bar, stack panel and every portal render outside `Layout`.
      run: 1m3s · 34 in · 4.2k out · sonnet-5 · sess:c3345043-95f7-4bb0-9f99-6eae65afb70c

### Thread
- [x] 2026-09-24 [note] The unrun fixes here moved to [[IDEA-285]], one run for everything still adrift from the baseline.
