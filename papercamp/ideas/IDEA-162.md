---
id: IDEA-162
title: One source of truth for checks
type: refactor
status: in-progress
created: 2026-08-13
updated: 2026-08-16
tags:
  - app
  - stack
  - status
subject: Run & monitor
---

The Stack panel reads two independent check backends and renders both at once.
They disagree today.

- `/api/checks` (`useDeskChecks`) drives the visible Checks stamps — types,
  lint, test, build — from `desk.checks` in `papercamp/config.json`.
- `/api/status` (the app store) carries `lint`, `format`, `test`,
  `consistency`, `build` — from `status.ts`'s hardcoded `CHECK_COMMANDS` plus
  `commands.build`.

`lint` and `test` exist in both with independent state. At the time of writing
`/api/status` reported lint `pass` (10:20) while `/api/checks` reported lint
`stale`: the panel said lint had never run while the store it also subscribes
to said it passed.

Three consequences are visible in the UI.

**`build` renders twice and contradicts itself.** The Checks group shows
`build` = `pnpm build` from `desk.checks`. The Build group reads `status.build`,
which resolves `commands.build` — a key this repo doesn't set — and prints "No
build command configured — set `commands.build` in `papercamp/config.json`" for
a command already declared one config block away. On the same row it shows
"Last built 12:14:38": that is `status.build.lastRun`, the timestamp of the
attempt that discovered there was no command. Nothing was ever built.

**`deriveCheckStatuses` output is never displayed.** `stack-panel.tsx` computes
`qualityStatus`/`testStatus`/`consistencyStatus` and uses them only to colour
the collapsed tab's dot.

**The collapsed tab's red dot is a dead end.** `anyChecksFailing` also folds in
`doctor.errorCount > 0` and `consistency.length > 0`, and neither is rendered
anywhere in the panel — or in the app: `doctor` is consumed by
`stack-panel.tsx` alone, purely to colour that dot. Any doctor finding produces
a red dot that the open panel cannot explain. Two real errors were invisible in
the entire UI this way (the `nextId.idea` collision, fixed separately).

Resolution: `desk.checks` is the single source of truth for what a check is and
what command it runs. `/api/status` keeps only what is genuinely not a desk
check — the commit gate's `consistency` — and drops its hardcoded
`CHECK_COMMANDS` and `commands.build`. The Build group folds into the Checks
group as an ordinary check carrying its own `lastRun`; `commands.build` is
retired in favour of `desk.checks[name=build]`. Every check stamp shows when it
last ran, `formatLastBuilt` includes a date when the run isn't from today, and
no timestamp is rendered for a run that produced nothing.

The collapsed tab's dot reports only what the open panel can explain. Doctor
findings and plan-consistency findings get rendered in the panel — they stay in
the dot, and the panel gains a place to show them, rather than being dropped
from the dot.

### Phases
- [x] Make desk.checks the single check source in status.ts
      Drop the hardcoded `CHECK_COMMANDS` and `commands.build`; `/api/status` keeps only the commit gate's `consistency`.
      run: 13m43s · 13.4k in · 63.9k out · sonnet-5
- [x] Fold the Build group into Checks as an ordinary check
      `build` renders once from `desk.checks[name=build]`, carrying its own `lastRun`.
      run: 3m18s · 4k in · 7.6k out · sonnet-5
- [x] Show lastRun on every check stamp
      `formatLastBuilt` includes a date when the run isn't from today, and renders no timestamp for a run that produced nothing.
      run: 3m17s · 4k in · 8.3k out · sonnet-5
- [x] Render doctor and plan-consistency findings in the panel
      run: 4m59s · 6.4k in · 17.5k out · sonnet-5
- [x] Drive the collapsed tab's dot only from what the panel renders
      Retire the unused `deriveCheckStatuses` coupling so the dot reports only explainable state.
      run: 3m20s · 3.7k in · 8.2k out · sonnet-5

### Fixes
- [ ] Render a failing check's captured output in the panel
      `DeskCheckState.output` is only ever used to build the copyable fix prompt (`checks-group.tsx:15`); nothing renders it for a human, so a red stamp says a check failed but never why. Today's Consistency failure named the exact nine-module import cycle and that text sat in `output` the whole time, reachable only by copying a prompt meant for an agent. Phase 4 established that findings belong in the panel — this is the one class of finding it left out. Show the failing check's output inline, collapsed by default, beside the existing fix prompt.

### Thread
- [x] 2026-08-15 [review] [agent] Comments · 0 findings — This is a clean, well-executed refactor that delivers all five phases: /api/status is stripped to just the commit-gate consistency check, the Build group is folded into Checks as an ordinary desk check with its own lastRun, every stamp shows a date-aware last-run time, doctor and plan-doc findings now render in a new Health section, and the collapsed tab's dot is driven only from desk-check failures, doc issues, and doctor errors — all of which the open panel can now explain. Type-checks pass, the check-fixes and check-status tests were faithfully rewritten around the new desk-check inputs, and no dangling references to the removed runCheck/fixQuality/BuildGroup/deriveBuildStatus symbols remain. One behavior change (auto-run-on-save loss) is worth flagging but isn't a spec violation.
