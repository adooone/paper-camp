---
id: IDEA-147
title: Scout panel replaces the sidesheet
type: feat
status: review
created: 2026-08-07
updated: 2026-08-11
tags:
  - integration
  - app
  - ux
  - chat
subject: In-app dev toolbar
order: 1
---

The embedded island gets its name: **Scout** — we send a scout into each
host project, and [[IDEA-130]]'s conversational agent already answers to
it. With the name comes a structural simplification: the island's
slide-in sidesheet ([[IDEA-138]]'s Stack-style chat sidebar) is removed,
and everything lives in the one panel that already opens from the logo
trigger ([[IDEA-140]]) — made slightly larger, a single Scout panel.

1. **The top stripe stays exactly as it is** — branch and changed count,
   the minimal-island banner ([[IDEA-144]]).

2. **Below it, two columns.** Right, the dominant area (~two thirds):
   the Scout chat thread — the conversation IS the island's main
   feature. Left, the quick glance: idea ID stamp, current phase title,
   its status and live progress (the [[IDEA-141]] fraction), and the
   "Open Paper Camp" link out to the full desk.

3. **The sidesheet is deleted, not hidden.** Its chat folds into the
   panel; no second surface, no slide animation, no state for which
   sheet is open. One trigger, one panel, everything visible at once.

4. **Reveal behavior is unchanged** — the logo trigger opens it as
   today; only the panel's size and contents change.

### Phases
- [x] Rename the island to Scout
      Update the component names, labels, and user-facing strings.
      run: 3m40s · 20.8k in · 19.1k out · sonnet-5
- [x] Delete the slide-in sidesheet
      Remove the component, its open/close state, and the slide animation.
      run: 3m59s · 524 in · 15.3k out · sonnet-5
- [x] Enlarge the logo-trigger panel
      Keep the reveal behavior; only grow the panel's size.
      run: 1m26s · 368 in · 4.9k out · sonnet-5
- [x] Lay out the two columns under the top stripe
      Glance column left (~one third), chat right (~two thirds).
      run: 57s · 236 in · 3.6k out · sonnet-5
- [x] Fold the chat thread into the right column
      run: 5m48s · 1.3k in · 14.3k out · sonnet-5
- [x] Populate the left glance column
      Idea ID stamp, current phase title and status, live progress fraction, and the Open Paper Camp link.
      run: 6m59s · 3.4k in · 19k out · sonnet-5

### Fixes
- [x] Enlarge panel further and wrap glance column in a textured Card
      Increase the Scout panel's overall size beyond the current enlargement. Wrap the left glance column in a paper-ui Card with canvas texture. Reduce the glance column's footprint so the chat thread on the right gets more visible history.
      run: 1m24s · 5.8k in · 4.7k out · sonnet-5
- [x] Fix panel sizing and padding
      Make the panel height static (no longer content-driven). Set the left glance Card to 40% of the panel width and full height. Reduce the panel's horizontal padding so it matches the vertical padding (equal x/y).
      run: 4m15s · 6.1k in · 18.5k out · sonnet-5

### Thread
- [x] 2026-08-07 [decision] The island is named Scout, after the agent. One panel from the logo trigger holds everything — git stripe on top, glance column left, chat dominant right, desk link out; the chat sidesheet is removed entirely.
- [x] 2026-08-10 [chat] panel should be bigger and left section should be put inside Card with canvas texture. There should be more space available for viewing chat history.
- [x] 2026-08-10 [chat] [agent] Added that as a fix here — bigger panel, left glance column wrapped in a Card with canvas texture, and more breathing room for the chat history. (reopened this idea to re-run)
- [x] 2026-08-11 [chat] height of the panel should be static. And left card with idea info should be 40% of the panel width and also have full height. And we should decrease side paddings of the panel, so y and x paddings to be equal.
- [x] 2026-08-11 [chat] [agent] Added that as a fix here — static panel height, left card at 40% width with full height, and equal x/y panel padding. (reopened this idea to re-run)
