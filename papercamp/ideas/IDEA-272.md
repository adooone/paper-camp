---
id: IDEA-272
title: A card per reviewed chunk
type: feat
status: review
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
- [x] Generalise the fix task to a list of findings
      `useFindingFixTask` takes many findings under one `night-chunk:<date>:<chunk>`
      issue id, joins their reasons critical first, and dismisses all of them on `done`.
      run: 1m47s · 32 in · 5.8k out · sonnet-5 · sess:23a3ad32-f83f-4dbf-9ce4-ae2e71222eb1
- [x] Replace the chunk `<details>` with a grid of cards
      One kraft `Card` per chunk with its stamps, checks line and *Fix all*, at any
      finding count — `CHUNK_COLLAPSE_THRESHOLD` and the flat list go.
      run: 7m5s · 84 in · 32.1k out · sonnet-5 · sess:23a3ad32-f83f-4dbf-9ce4-ae2e71222eb1
- [x] Add the `/findings/chunk/$chunk` route and view
      Head card with name, date, pass count and cost, then the chunk's findings as
      `renderFindingRow` sorted by severity then file, with *Fix all* on the bottom bar.
      run: 8m57s · 172 in · 33.7k out · sonnet-5 · sess:12fed03e-4c98-473b-8f60-379e98a5c292
- [x] Reflect a fix in flight on both surfaces
      The card and the head card show the *fixing* stamp and disable *Fix all* while the
      chunk's task is active.
      run: 1m19s · 34 in · 3.2k out · sonnet-5 · sess:2f5b0ed6-bf24-4498-a388-0f80785250d5

### Fixes
- [x] Fold the finding page into the chunk view
      A finding never opens its own page: `/findings/$findingId`, `finding-detail.tsx`,
      its route and `onOpen` go. The chunk view lists its findings as a paper-ui `Table`
      with `hideHeader`, two lines per row so nothing is cut: the first line is the
      severity and check stamps with `file:line` in mono, the second is the finding's
      full message. A trailing actions column carries *Fix*, *Promote* and *Dismiss*
      as small ghost buttons — *Fix* launches `useFindingFixTask` for that one finding
      and shows *fixing…* in place of the button while it runs, *Promote* is the same
      idea-extend launch `finding-detail.tsx` made, *Dismiss* removes the row.
      run: 7m31s · 142 in · 23.4k out · sonnet-5 · sess:affa66a6-c455-4913-8df4-7952fed50f5d
- [x] A breadcrumb for the chunk view
      `PageBreadcrumb` derives one more trail: when the `chunk` route param is set,
      *Plans › src/core*, with *Plans* navigating to `/`. The view has no way back
      today except the browser's.
      run: 1m · 20 in · 1.8k out · sonnet-5 · sess:affa66a6-c455-4913-8df4-7952fed50f5d
- [x] Facts beside the title, not under it
      The head card is one line: the chunk in mono on the left with its severity
      stamps beside it, and Date, Passes and Cost right-aligned on the same line as
      compact label-over-value pairs. The `FactsGrid`, its divider and the empty
      right half go; on a phone the facts wrap under the title.
      run: 46s · 16 in · 2.9k out · sonnet-5 · sess:3b936787-1091-4b41-8f34-ec7276bb0d6c
- [ ] One review, not one per date
      `buildNightReportGroups` returns a single group: every open finding, headed by
      the newest date among findings and passes, with that date's pass count and cost.
      Chunk cards and the chunk view merge findings across dates, so `nightChunkKey`,
      `chunkRouteParam` and the *Fix all* issue id `night-chunk:<chunk>` drop the
      date. Two headers with two rows of cards for the same chunks is what this
      replaces; [[IDEA-273]] keeps a second date from arising at all.
- [ ] Handwritten where the app is handwritten
      The card's checks line and the header's date take `font-handwritten`, as every
      other secondary line and date on the Plans page does; the serif in both is
      the one place the section falls out of the sheet's voice.
