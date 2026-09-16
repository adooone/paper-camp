---
id: IDEA-272
title: A card per reviewed chunk
type: feat
status: idea
created: 2026-09-16
tags:
  - app
  - ui
  - plans
subject: App UI
order: 1
---

The findings group on the Ideas page collapses past ten findings into one
`<details>` line per chunk — `src/core · 17 findings` — three lines that
take a third of the screen to say almost nothing, with the same rows the
flat list uses folded under each. A chunk is what a review pass reads at a
time, so it is also the unit a fix should take at a time: 26 findings sit
in 20 files, nearly one per file, and the finding page already fixes one.

**A grid of chunk cards.** The `<details>` list goes. Under the *Review
findings* line, one `Card` per chunk in a `grid-cols-3` on desktop and
one column under 640px: the chunk in mono as the title, its severity
counts as the same stamps the header uses, and the checks that fired in
one muted line. Every card is `texture="kraft"`, the surface the hub's
number cards already use, so the group reads as something other than the
parchment idea rows below it. The chunk cards render at any count — the
`CHUNK_COLLAPSE_THRESHOLD` flat list is gone too, a pass with three
findings gets three small cards.

**A card opens a chunk view.** `/findings/chunk/$chunk` is a corpus-layer
route rendered inside `PlansPage` like `/findings/$findingId`, laid out
like an idea: a head card with the chunk name, the date, the pass count
and cost; then the chunk's findings as today's rows — `renderFindingRow`
unchanged — sorted by severity then file, each opening its finding page,
each keeping its dismiss.

**Fix all is one task.** The chunk view's bottom bar and each card carry
*Fix all*, and both launch one `issue-fix` task through `launchIssueFix`
with `issueId` `night-chunk:<date>:<chunk>`, whose reason is every
finding's `findingFixReason` block joined in severity order, critical
first. `useFindingFixTask` generalises to a list of findings: while the
task is active the card and the head card show the same *fixing* stamp
the finding page shows, and on a `done` outcome every finding in the list
is removed through `dismissNightFinding`, the rule a single fix already
follows. A chunk with a fix in flight disables its *Fix all* everywhere;
a single finding's *Fix it here* stays enabled, since a second task on
the same file is the human's call.

**Everything else stays.** *Promote* and *Fix it here* stay on the
finding page. Dismiss stays per finding; there is no dismiss-all, because
a chunk's findings are not one decision.

### Out of scope

The pass, its checks, and the finding page's own layout. What the fix
task's agent does with the prompt.

### Phases
- [ ] Generalise the fix task to a list of findings
      `useFindingFixTask` takes many findings under one `night-chunk:<date>:<chunk>`
      issue id, joins their reasons critical first, and dismisses all of them on `done`.
- [ ] Replace the chunk `<details>` with a grid of cards
      One kraft `Card` per chunk with its stamps, checks line and *Fix all*, at any
      finding count — `CHUNK_COLLAPSE_THRESHOLD` and the flat list go.
- [ ] Add the `/findings/chunk/$chunk` route and view
      Head card with name, date, pass count and cost, then the chunk's findings as
      `renderFindingRow` sorted by severity then file, with *Fix all* on the bottom bar.
- [ ] Reflect a fix in flight on both surfaces
      The card and the head card show the *fixing* stamp and disable *Fix all* while the
      chunk's task is active.
