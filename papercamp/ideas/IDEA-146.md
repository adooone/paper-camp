---
id: IDEA-146
title: Deliver lives in the idea view
type: feat
status: review
created: 2026-08-07
updated: 2026-08-10
tags:
  - app
  - ui
  - stack
  - git
subject: App UI
order: 1
---

Deliver sits in the Stack panel, a room away from the work it closes:
you watch phases land in the idea view, then leave it to commit. Move
delivery into the idea view — not the card copied over, but the flow
integrated into the sheet:

1. **A Deliver section below Phases**, in the page's own grammar (same
   section heading style as Phases/Feedback, no dark sub-card). It
   appears when the idea's branch has uncommitted changes or a finished
   run, and reads top-down like the work itself: checks row → changes →
   commit.

2. **The basic features carry over**: the four check stamps
   (Quality / Tests / Consistency / Docs), the "N files changed" link
   into the Changes page ([[IDEA-145]]), the commit title input with the
   suggest-from-diff action, and Commit. Fix-review's suggested-commit
   prefill keeps working — it lands in this section now.

3. **Checks auto-run when a run completes.** Run-all's last phase (and
   any standalone final phase) triggers the full check suite so the
   section greets you with fresh stamps — style and lint issues surface
   without anyone pressing anything. Mid-run, the stamps keep their
   existing live states.

4. **The Stack panel narrows to what remains: agent activity and the
   desk.** Deliver leaves it entirely; branch-level git (Sync/Push/Pull
   and the ambient branch + changed count) stays in the toolbar
   ([[IDEA-94]]), so nothing loses a home: toolbar = repo ambient, idea
   view = this idea's delivery, Stack = who's working and whether the
   desk is healthy.

5. **The Desk section stops collapsing.** The space Deliver frees goes
   to [[IDEA-119]]'s Desk section: drop its Accordion and the persisted
   `desk-section-expanded` flag — services, checks, and the release
   train render open, always. A monitor you have to unfold isn't
   monitoring.

### Phases
- [x] Add the Deliver section to the idea view
      Render it below Phases in the page's section grammar, gated on uncommitted changes or a finished run, laid out checks row → changes → commit.
      run: 5m5s · 13k in · 21.1k out · opus-4-8
- [x] Carry the delivery controls into the section
      The four check stamps, the "N files changed" link, the commit title input with suggest-from-diff, and Commit; keep fix-review's suggested-commit prefill landing here.
      run: 6m45s · 4.2k in · 26.2k out · opus-4-8
- [x] Auto-run the check suite on run completion
      Trigger the full suite from run-all's last phase and any standalone final phase, leaving mid-run live stamp states untouched.
      run: 3m42s · 371 in · 12.2k out · opus-4-8
- [x] Remove Deliver from the Stack panel
      run: 2m45s · 1.1k in · 7.6k out · opus-4-8
- [x] Make the Desk section always open
      Drop its Accordion and the persisted `desk-section-expanded` flag.
      run: 1m10s · 222 in · 2.8k out · opus-4-8
- [x] Redesign Deliver as a two-column Card
      Below Phases, wrap Deliver in a Card with two columns: left holds the check stamps and changed-files info, right holds the commit title input, suggest action, and Commit button.

### Thread
- [x] 2026-08-07 [decision] Owner direction: delivery moves from the Stack panel into the idea view, integrated below Phases rather than transplanted as a card. Stack keeps agent activity plus an always-open Desk section (Accordion and persisted flag removed); the toolbar keeps repo-level git. Checks auto-run on run completion.
- [x] 2026-08-10 [chat] redesign deliver section. I want it to be a Card below the phases list with 2 columns, one with information files and checks and another with commit section.
- [x] 2026-08-10 [chat] [agent] Added that as a fix here — restructure Deliver into a two-column Card below Phases: left column for check stamps and changed-files info, right column for the commit controls.
