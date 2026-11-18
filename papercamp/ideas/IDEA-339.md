---
id: IDEA-339
title: The desk's own features on new paper
type: feat
status: planned
created: 2026-11-16
updated: 2026-11-16
tags:
  - app
  - ui
  - stack
needs:
  - IDEA-338
subject: App UI
---

The phone's screens (IDEA-338) cover what the phone does; the desk does
more. The Stack panel is the control surface where every agent action
lives, and the roadmap, stats, diff, docs, desk-check and CI tables, the
night report and run-order management exist only on the web. They come
to the second client on the new paper, in the phone's language: the dark grey
chalkboard (paper-ui/IDEA-18) where the green one was, kraft for
controls, sheets for rows, uppercase labels, mono stamps,
kraft buttons, with folk-ui's `Table`, `Menu`, `Drawer`, `Modal` and
form controls as the furniture.

**The Stack panel is a grey chalkboard.** The same sections as
`src/app/components/stack-panel/` (agent, batch, desk checks, git,
services, CI, capacity, signed-out, version) on folk-ui's chalkboard
surface under `data-chalk="grey"`, with kraft buttons and mono stamps, docked at 288px widening to 360px from 1271px, an overlay
`Sheet` below 1199px, the reopen tab at the phone's thumb height. No
green anywhere.

**The pages.** Roadmap horizons and unfiled items as `ListRow`s under
`ListLabel`s; stats as `KraftCard` tiles with mono figures; the diff view
on the grey chalkboard with folk-ui's `CodeBlock`; docs pages on `Paper` with
the title face for headings; the desk-check, service and CI tables and
the night report with folk-ui `Table` inside `KraftCard`s; run order
with the phone's segment pills for the queue.

**Acceptance.** Every route of `/` has a counterpart under `/next/` with
the same actions available; the Stack panel runs, queues, fixes and
stops exactly as on `/`; a run's output streams onto the grey chalkboard, and no green
chalkboard appears anywhere under `/next/`.

### Phases
- [ ] The Stack panel on the grey chalkboard
      Port the stack-panel sections onto the grey chalkboard surface with the new controls, docking, overlay and reopen tab; action parity tests against the shared agent store.
- [ ] Roadmap and stats
      Horizons and unfiled rows; stat tiles with mono figures.
- [ ] Diff and docs
      Diff on the grey chalkboard with `CodeBlock`; docs pages on `Paper`.
- [ ] Settings tables, night report, run order
      Desk-check, service and CI tables, the night report, run-order management with segment pills.
