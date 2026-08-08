---
id: IDEA-136
title: Roadmap page redesign
type: fix
status: in-progress
created: 2026-08-06
updated: 2026-08-08
tags:
  - app
  - ui
  - roadmap
subject: Planning surface
order: 1
---

Visual review of the Roadmap page (2026-08-06): three views fragment one
picture, and the Outline's card grid can't balance. Board is a strict
subset of Outline (name + progress bar); Timeline is unlabeled dots on a
days-old axis with nothing linking to it; the switcher resets on every
visit and has no deep links. Outline's cards (`flex-[1_1_240px]
max-w-[320px]`, content-driven heights) produce a ragged pseudo-masonry,
"Promote to idea" repeats as a full button on every card, idea link trails
render twice (card face and expansion), and the goal renders display-font
`text-lg` clamped to one truncated line — a huge heading that says half a
sentence — on a page that has no title of its own.

Since roadmap items are the worklist's subject vocabulary ([[IDEA-95]]),
the roadmap becomes the strategic mirror of the Plans page, in the same
visual grammar — full-width rows, not cards:

1. **One view, no switcher.** Board ([[IDEA-81]]) and Timeline
   ([[IDEA-92]]) are deleted outright, along with the view-mode state.
   Board's progress data survives inside the rows.

2. **Item = full-width row** under its horizon heading: expand caret +
   name + slim progress bar + count stamps (`n in queue`, `n shipped`,
   `n candidates`) on one line. Uniform row heights; no buttons on
   collapsed rows.

3. **Expanded row**: the description, one merged idea list (status stamp +
   PR badge per idea — replacing today's duplicated link-trail and
   graduated rows, [[IDEA-93]]), candidate rows with their promote
   affordance ([[IDEA-77]]), "Add option", and the single "Promote to
   idea" button.

4. **Header**: normal "Roadmap" page title, goal beneath in body font
   ([[IDEA-74]]) — first paragraph always fully visible, never clamped;
   remaining paragraphs behind Show more. Display font stays reserved for
   the title, like every other page.

5. **The "N graduated · M charted" pulse caption dies** — the rows' bars
   and stamps carry it, in vocabulary the rest of the app already uses.

6. **Deep-linking stays**: `?item=` auto-expands and scrolls to its row.

### Phases
- [x] Delete Board and Timeline views and the view-mode state
      Keep Board's progress data; fold it into the row model.
- [x] Build the full-width item row under its horizon heading
      Expand caret, name, slim progress bar, and count stamps on one uniform line; no buttons collapsed.
- [x] Build the expanded row body
      Description, one merged idea list (status stamp + PR badge), candidate rows with promote, "Add option", single "Promote to idea".
- [x] Rework the header
      Normal "Roadmap" title with the goal beneath in body font: first paragraph always visible, rest behind Show more.
- [x] Remove the "N graduated · M charted" pulse caption
- [x] Wire deep-linking: `?item=` auto-expands and scrolls to its row

### Fixes
- [x] Make rows clickable and match Inbox list styling
      Rows navigate on click (not just the expand caret); adopt the same row visual treatment used in the Inbox list (spacing, hover, typography) instead of the current bespoke styling.
- [ ] Add left sidebar with quick filters and an Add item button
      Mirror the Plans page's left sidebar layout: horizon/status quick filters for the roadmap list, plus an Add item button to create a new roadmap item.

### Thread
- [x] 2026-08-06 [decision] The three roadmap views collapse into one row-based view; Board and Timeline are deleted, not hidden. Promote lives only in the expanded row. The goal is body text under a normal page title — always readable, never truncated.
- [x] 2026-08-08 [chat] rows should be clickable, and also I want to make this list the same design as we have in the inbox. And another point is to add sidebar at the left as in Plans page and add some quick filters for the roadmap and add item button.
- [x] 2026-08-08 [chat] [agent] Added two phases: making rows clickable and matching the Inbox's list styling, plus a left sidebar (mirroring Plans) with quick filters and an Add item button. (reopened this idea to re-run)
