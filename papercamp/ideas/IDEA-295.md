---
id: IDEA-295
title: A clearer Activity page
type: feat
status: in-progress
created: 2026-10-13
tags:
  - app
  - ui
  - activity
needs:
  - IDEA-294
subject: App UI
order: 4
---

Activity reads as a pile. Under the title sit a search with three selects,
then a row of outcome stamps, then a row of type stamps. That's three ragged
lines that change height with the data. A run in progress is just the top row
of the list, styled like every finished one: it shows no phase and no elapsed
time, and it can't be stopped from the list. Each row spends fixed columns on
the time, the type stamp and the outcome, so the title gets about ten
characters ("A compact I…"). The entry page stacks a card with a two-column
facts grid (*Started*, *Agent*) over a short output pane. Its actions are
buried in the card body, and the log never grows past a small box. The page
gets the shape the Ideas page takes in [[IDEA-294]]: filters in the sidebar,
one toolbar row, a kraft header that sorts, and a running card pinned above
the list.

**The sidebar holds the filters.** Under *Projects in view* come two
sections of `CheckboxFilterRow`s (from IDEA-294), each row with its count in
the muted 2xs face and each section with *Clear* when it differs from the
default. *Outcome* lists running, done, error, superseded, open and
interrupted, each shown only when it has entries. *Type* lists the run types
present (Run all phases, Reply, Feedback reply, Fix review, PR review and the
rest), labelled from `LOG_TYPE_LABELS`. The `outcomes` and `types` URL search
params keep their meaning. The kind chips and both stamp rows leave the
toolbar.

**One toolbar row.** Under the title row (*Activity*, the *N unread* stamp,
*Mark all read*) there is exactly one toolbar row, 32px tall, that never
wraps: *Search activity…* (`flex-1`, `min-w-[140px]`), then the *Agent*
select and the *Range* select. The *Sort* select goes; sorting moves to the
header. The stats line (*11 runs · 1 failed · 91% success · $72.11 total ·
30m24s median*) stays under the toolbar.

**Running runs get a card above the list.** Every task in the current
project's agent status with a running status renders as one card on the
amber wash, pinned above the list header and outside the sort:
- **First line:** a pulsing dot, *Running* (or *Stopping…*), the idea id,
  *phase N of M* (from `phaseIndex` and the plan's phase count), elapsed time
  ticking each second, the agent label, then *Open log* and a danger *Stop*.
- **Second line:** the latest output line in the mono face, truncated with
  an ellipsis.

Running rows leave the list itself. When a run ends, its card goes and its
finished row appears at the top of the list. The *N running* stamp in the
title row goes, since the cards replace it.

**A kraft header that sorts.** The list's header is a
`<Row surface="card" texture="kraft">`, one fixed 32px band with the labels
*Time*, *Type*, *Idea*, *Title*, *Took*, *Cost* and *Outcome*. *Time*,
*Took* and *Cost* are sort buttons, behaving like the Ideas header in
IDEA-294: the active label is semibold with a 12px arrow icon, clicking it
again flips the direction, and `aria-sort` sits on the header cell. They map
to the `sort` param's `time`, `duration` and `cost`. Rows and header share
one grid: `78px 104px 72px minmax(0,1fr) 56px 56px 72px`, with *Cost* hidden
below `lg`. Time is `HH:MM` for today and `Oct 12` before that, with the
full timestamp in a tooltip. *Took* falls back to wall-clock time when a run
recorded no usage. The title column takes all the remaining width.

**The entry page leads with what to do.**
- **Title row:** the run title as the page heading, its idea id stamp, then
  the actions on the right. A running run shows *Open idea* and *Stop*. A
  failed one shows its fix and promote actions, moved up out of the body. A
  finished one shows *Open idea*.
- **Facts line:** one wrapping line in place of the `FactsGrid` card. The
  type stamp and the outcome stamp, then label–value pairs: *Started*,
  *Took* (*Elapsed* while running), *Phase N of M*, *Turns*, *Cost*, *Model*,
  *Agent*.
- **Body:** a reply, a parked question or a failure's reason renders in a
  card under the facts line only when the entry has one.
- **Output pane:** fills the rest of the viewport. It's `max-height:
  calc(100vh - <header offset>)`, and it scrolls inside itself.

**The output pane gets controls.** The pane header shows *Output*, the
*Live* marker while running, the line count, and two ghost buttons on the
chalkboard surface:
- **Follow:** pressed by default while live. It keeps the newest line in
  view. Scrolling up releases it, and pressing it again jumps back to the
  end.
- **Copy:** copies the whole log to the clipboard and confirms with a toast.

Done when Activity's header block is one title row plus one toolbar row at
any data, a running agent can be stopped from the list, and an entry page
shows its log at full height.

### Out of scope

Activity across machines. Chat (its own page since IDEA-293). Filtering by
date in the sidebar.

### Phases
- [x] Pin running runs in a card with Stop
      Card per running task with phase, ticking elapsed time, agent, latest
      line, Open log and Stop; running rows leave the list; the N running
      stamp goes.
      run: 8m47s · 154 in · 25.2k out · sonnet-5 · sess:b7b18499-103a-4a30-9b1c-c3d9163d5bd9
- [x] Move Activity filters to sidebar checkbox rows
      Outcome and Type sections with counts and Clear on the existing URL
      params; the toolbar becomes search, Agent and Range on one row; kind
      chips and stamp rows removed.
- [ ] Shorten the list's times
      The kraft header, its Time/Took/Cost sort labels and the Cost column
      (wide screens) already landed with phase 2; what remains is `HH:MM` for
      today and `Oct 12` before that, with the full timestamp in a tooltip.
- [ ] Lay out the entry page around its actions
      Title row with Open idea, Stop or the failure actions; the one-line facts
      replacing the FactsGrid card; the body card only when there is a body.
- [ ] Give the output pane Follow, Copy and full height
      Viewport-height pane scrolling inside itself, Follow toggle released by
      scrolling up, Copy with a toast.
