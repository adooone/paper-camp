---
id: IDEA-77
title: Candidate ideas under roadmap items
type: feat
status: idea
created: 2026-07-21
tags:
  - app
  - plans
  - docs
  - ui
subject: Workflow
---

The organisation ladder has a missing rung. Horizons hold items, items promote to ideas — but a big item ("Mobile control desk") is *several* ideas, and today there's nowhere to hold its decomposition short of promoting everything at once or keeping the list in your head. The "big bet graduates as a Subject" rule exists only as prose. Give the ladder its rung with the smallest possible change: **nested candidate bullets** in the roadmap grammar, on top of everything that already exists — no new entity type, no new file.

```markdown
- **Mobile control desk** — direct the flow from a phone…
  - Responsive polish for phone widths
  - PWA manifest + install to home screen
  - Push notifications for task/check events
```

An indented `- ` line under an item is a candidate: a named, promotable slice that hasn't earned an idea file yet. Items without candidates keep today's direct one-click promote unchanged. Caution for the implementer: the current `ITEM_CONTINUATION_RE` swallows indented lines into the description — the grammar change must land before any nested bullets are seeded into `ROADMAP.md`, or the Roadmap page garbles.

- **Grammar.** `parseRoadmap` gains `candidates: string[]` per item (indented bullets; plain text, no bold-dash needed), and `removeRoadmapItem` learns to remove a single candidate — with the parent item removed too when its last candidate graduates and the parent has no standalone promote-worthiness left (judged: keep parent if it still has candidates or was never promoted itself).
- **Expandable items on the Roadmap page.** Items with candidates render a chevron (the Tasks-page expand pattern); expanded, each candidate is a row with its own *Promote to idea*. Promoting a candidate auto-assigns **subject = item name** — created in `config.json` subjects if absent — making the big-bet-becomes-a-Subject rule mechanical. The subject picker in the promote modal stays for overrides.
- **Visual linking through the subject.** The item row shows a live graduation count ("2 in queue, 1 shipped") computed by matching ideas whose subject equals the item name; clicking it opens the Ideas page filtered to that subject. The promoted idea's provenance line gains the item name ("From the roadmap: Horizon 3 — Mobile control desk"), so map → queue and idea → map both navigate.

### Phases
- [x] Extend the roadmap grammar with candidates
      `parseRoadmap`: indented `- ` bullets under an item become `candidates: string[]` (description continuation still works for indented prose without the bullet marker); `removeRoadmapItem` gains single-candidate removal with round-trip fidelity. Tests for parse, continuation-vs-candidate disambiguation, and removal.
- [x] Render and promote candidates
      Roadmap page: chevron-expandable items listing candidate rows, per-candidate Promote through the existing promotion path with subject defaulted to the item name (auto-created in config if new); candidate bullet removed from `ROADMAP.md` on promote.
- [ ] Link map and queue both ways
      Item rows show the graduated-idea count via subject match, clicking through to the Ideas page pre-filtered to that subject (the filter store already supports it or gains a subject filter); promoted ideas' provenance line carries the item name.
- [ ] Gate the pass
      `tsc --noEmit`, `biome check`, tests green; seed Mobile control desk's real candidates into ROADMAP.md (safe once the grammar landed), promote one end-to-end, and confirm the count, the filter click-through, and the backlink all agree.
