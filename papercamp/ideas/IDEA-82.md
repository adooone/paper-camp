---
id: IDEA-82
title: Order that can never be empty
type: fix
status: idea
created: 2026-07-21
tags:
  - app
  - server
  - plans
  - agent
subject: Workflow
order: 1
---

The run-order invariant ([[IDEA-71]]: contiguous 1..N over planned/in-progress/review, visible as gutter stamps) has a hole: it's enforced only on the plans PATCH route. Every other way an idea enters the ordered set bypasses it — promotion routes mint new files, `POST /api/plans` creates them, and draft-plan agents write phases directly to disk, flipping derived status to `planned` without any route involved. Result observed in the wild: an entire generation of ideas (78–81) sitting in the queue with empty markers. An invariant that only holds on one write path isn't an invariant.

Two layers, split by the house rule (deterministic file ops, judgment for agents):

- **Deterministic floor — enforce at the corpus seam, not per route.** The server already watches `papercamp/` for changes (the SSE activity tick). Hang a debounced invariant pass off that watcher: read work entries, compute derived statuses, run `normalizeRunOrder`, write only the changed files. Any write path — route, agent, hand edit, git pull — converges to a legal ordering within a tick; new actives append at the end (by created date), exactly as the normalizer already does. Guard against write-loops: the pass writes only when changes exist, and its own writes produce a no-op second pass.
- **An actions menu, not a button shelf.** The list header already carries refresh / suggest ideas / actualise all; adding a shuffle makes four. paper-ui's `Menu` (trigger + entries, portal-rendered) consolidates them into one actions popup — the header stays quiet, and future list-level actions get a home instead of a new button.
- **Judgment on demand — a shuffle agent.** Appending at the end is legal but dumb; deciding what *should* run first is judgment. A "Prioritise queue" action (shuffle icon in the worklist header) launches a read-only agent over the corpus and `ROADMAP.md` — dependencies between ideas, horizon of their subjects, staleness, size — that ends with a fix-review-style JSON verdict: `{"order": ["IDEA-80", "IDEA-79", …], "why": "one line per move"}`. The server applies the verdict deterministically through the normalizer (the [[IDEA-67]] lesson: the model proposes, the code writes), and the reasons land as a Comment on each moved idea so the shuffle explains itself.

### Phases
- [x] Enforce the invariant at the watcher seam
      Debounced invariant pass off the corpus watcher: derived statuses → `normalizeRunOrder` → write changed files only, loop-safe (a pass whose writes trigger a second pass must no-op). Tests: an entity file gaining phases out-of-band gets an order within a pass; a PATCH-created ordering is left untouched.
- [ ] Add the shuffle agent
      New read-only task kind `prioritise` (registry-visible like commit-suggest): prompt over the worklist + roadmap, JSON verdict with full-permutation validation (every active id exactly once — the fix-review partition discipline); server applies via the normalizer and appends a one-line reason to each moved idea's log.
- [ ] Consolidate header actions into a Menu
      The worklist header's accumulating buttons (refresh, suggest ideas, actualise all, and now prioritise) move into a paper-ui `Menu` (trigger + `MenuEntry[]` items, already in the library) — one ⋯ actions trigger next to the title, each entry with its icon and disabled/running state; frequently-used refresh may stay outside, judged at implementation. Prioritise lives in this menu; verdict application refreshes the list so the stamps visibly reorder.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green; draft a plan on an orderless idea and watch it gain a stamp without any PATCH; run the shuffle and confirm stamps, files, and per-idea log reasons all agree.
