---
id: IDEA-81
title: Make the roadmap look like a map
type: feat
status: idea
created: 2026-07-21
tags:
  - app
  - ui
  - plans
  - docs
subject: Frontend
---

The Roadmap page reads like a printed document with buttons bolted on. Three concrete failures: the goal masthead eats half the viewport on every visit; items render as full-width paragraph walls, so seeing the whole map takes three screens of scrolling and nothing is glanceable; and the page is state-blind and workflow-detached — it shows intentions, but not which items are moving, and the only verb is Promote (adding an item or candidate still means hand-editing `ROADMAP.md`). A map you can't survey, and can't draw on, is a page you stop visiting.

The redesign principle: **the map should look like a map, and the desk should be able to draw on it.**

- **Slim goal banner.** The bold first sentence on one line, the rest behind an expand — the goal orients, it shouldn't occupy.
- **Horizons as columns.** Three columns at lg (stacked below): the whole map on one screen. Column header: handwritten horizon title plus a progress line ("2 graduated · 5 charted") so each era shows its pulse.
- **Compact item cards.** Name + two-line clamped description; a stamp row carrying "N in queue" / "M shipped" (status-stamp colors) and a candidate-count chip. Expanding a card reveals the full description, the candidate list with per-candidate Promote, and — the state the page currently hides — the item's actual graduated ideas with their live status stamps (subject match; plans are already loaded globally).
- **Draw on the map.** "Add item" per horizon and "Add candidate" per expanded item: small inputs that write the bullet into `ROADMAP.md` through the existing grammar (parse → splice → write, the same round-trip promotion already trusts). Capture belongs at every level of the ladder, not just the idea level.
- **The queue points back.** Worklist subject-group headers whose name matches a roadmap item get a small map link to `/roadmap` with the item highlighted (`?item=` param + the existing highlight-ring pattern) — closing the loop the graduation counts opened.

### Phases
- [ ] Compact the layout
      Slim expandable goal banner; horizons as responsive columns with progress lines in the headers; item cards clamped to name + two-line description + stamp row. Pure presentation over the existing `/api/roadmap` data.
- [ ] Expand cards with live state
      Card expansion (chevron pattern): full description, candidates with per-candidate Promote (existing), and the graduated-ideas list with status stamps derived from the loaded plans by subject match.
- [ ] Write to the map from the UI
      `POST /api/roadmap/items` and `/api/roadmap/candidates` appending a bullet via the grammar round-trip (with tests); "Add item" input per column, "Add candidate" per expanded card.
- [ ] Link the queue back to the map
      Subject-group headers in the worklist link to `/roadmap?item=<name>` when the subject matches an item; the roadmap highlights and scrolls to that item (existing highlight-ring + scrollIntoView pattern).
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green (grammar-append round-trip covered); click through in Chrome: whole map on one screen at lg, add an item and a candidate from the UI, promote a candidate, follow a subject header from the queue to its highlighted item.
