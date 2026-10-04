---
id: IDEA-288
title: The status bar, roadmap rows and title gaps
type: fix
status: review
created: 2026-10-02
updated: 2026-10-04
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 1
---

The migration is done. A side-by-side of this build against the
`7a58b8b7` deployment, measured in the browser, finds the fonts and
colours identical everywhere checked; what is left on this side is
layout that the adoptions changed and the baseline did not have. paper-ui's
IDEA-12 takes the five library rules; this takes the app's own four.

**The status bar folds only when it must.** `OverflowToolbar` measures
its own box, and in `status-bar-core.tsx` it sits after a `flex-1` spacer
with `flex: 0 1 auto`, so its width is its content's and it folds its
lowest item even with 300px of bar empty — *Refresh data* is in the
*more* menu at 1440px, where the baseline showed it. The spacer goes and
the toolbar takes `className="min-w-0 flex-1 justify-end"`, so its width
is the free space, as the baseline measured the whole bar less the chat
and bell.

**Setup stands on the left.** The baseline drew the *Setup (1)* stamp in
the left group beside the change count; the adoption moved it into the
toolbar on the right. It returns to the left group as a pressable `Stamp`
with its tooltip and is not a fold candidate — at 420px the left group
still fits beside the chat, bell and *more*.

**Roadmap rows are 54px again.** `roadmap-item-row.tsx` and
`standing-concern-row.tsx` render a `Row` with the row's own vertical
padding on top of the 32px title and 21px description, so each row is
67px where the baseline's was 54px and the page is 240px longer by the
end. The rows pass `py-0`; their rule and horizontal inset are unchanged.

**Page titles keep their gap.** `PageTitle` carries `margin-bottom:
1.5rem`; the Log, Chat and Roadmap pages pass `mb-0`, which in the
baseline lost to the title's own `mb-6` by stylesheet order and so never
took effect — those titles had 24px under them, and now have none. The
`mb-0` goes from `runs-page.tsx`, `chat-page.tsx` and `roadmap-page.tsx`;
`git-page.tsx`'s `!mb-0` was real in the baseline and stays.

**Link buttons keep their classes.** `run-title-actions.tsx` and
`chat-title-actions.tsx` lost `font-handwritten text-sm opacity-70` when
their raw buttons became `Button variant="link"`, so *Mark all read* and
*Clear chat* render in the body serif. The classes return on the
`className`.

**Acceptance is the same comparison.** Production against the
`7a58b8b7` deployment, both paired to this daemon, on the Plans list with
the Done filter, Roadmap, Log, Git, Settings and the stack panel at
1440px; and, once a window narrower than 480px can be had, the Plans
list, Roadmap and Settings at 420px, which this pass could not reach.

### Out of scope

The chunk view, redesigned on purpose. The five rules in paper-ui's
IDEA-12, which the bump that follows its release picks up with no change
here.

### Phases
- [x] Let the status bar toolbar own the free space
      Drop the `flex-1` spacer in `status-bar-core.tsx` and give `OverflowToolbar` `min-w-0 flex-1 justify-end`.
      run: 37s · 20 in · 1.5k out · sonnet-5 · sess:f525be77-9098-4300-91fc-259b0cb206f1
- [x] Move the Setup stamp back to the left group
      Render it beside the change count as a pressable `Stamp` with its tooltip, out of the toolbar's item list.
      run: 31s · 14 in · 1.4k out · sonnet-5 · sess:f525be77-9098-4300-91fc-259b0cb206f1
- [x] Pass `py-0` on the roadmap rows
      In `roadmap-item-row.tsx` and `standing-concern-row.tsx`, leaving rule and horizontal inset alone.
      run: 29s · 16 in · 1.1k out · sonnet-5 · sess:f525be77-9098-4300-91fc-259b0cb206f1
- [x] Restore the page title gaps and link button classes
      Drop `mb-0` from the Log, Chat and Roadmap pages; return `font-handwritten text-sm opacity-70` to the two title actions.
      run: 56s · 28 in · 2.4k out · sonnet-5 · sess:f525be77-9098-4300-91fc-259b0cb206f1
- [ ] [manual] Compare production against the `7a58b8b7` deployment
      The 1440px pass over Plans, Roadmap, Log, Git, Settings and the stack panel, plus 420px once a narrow enough window can be had.
