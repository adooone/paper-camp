---
id: IDEA-147
title: Scout panel replaces the sidesheet
type: feat
status: idea
created: 2026-08-07
tags:
  - integration
  - app
  - ux
  - chat
subject: In-app dev toolbar
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
- [ ] Delete the slide-in sidesheet
      Remove the component, its open/close state, and the slide animation.
- [ ] Enlarge the logo-trigger panel
      Keep the reveal behavior; only grow the panel's size.
- [ ] Lay out the two columns under the top stripe
      Glance column left (~one third), chat right (~two thirds).
- [ ] Fold the chat thread into the right column
- [ ] Populate the left glance column
      Idea ID stamp, current phase title and status, live progress fraction, and the Open Paper Camp link.

### Thread
- [x] 2026-08-07 [decision] The island is named Scout, after the agent. One panel from the logo trigger holds everything — git stripe on top, glance column left, chat dominant right, desk link out; the chat sidesheet is removed entirely.
