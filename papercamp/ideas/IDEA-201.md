---
id: IDEA-201
title: Boards and tickets
type: feat
status: review
created: 2026-08-21
updated: 2026-08-21
tags:
  - corpus
  - app
  - planning
subject: The format as the product
order: 7
---

An idea with a phase list is the right unit for something small and quick. For a project the size of the multi-project hub it is the wrong one: the work splits into several independently plannable pieces, and a flat checklist cannot carry status, an agent run, or a thread per piece. A **board** is an idea that decomposes into **tickets** instead of phases, and a ticket is a full entity with everything an idea has — phases, status, thread, agent runs.

This is a generalisation of what [[IDEA-187]] already shipped rather than a new mechanism. A fix entity is a child linked to its parent through the `idea:` backlink, rendered inside the parent's view as a clickable list with an id stamp, a title, and a status stamp. Boards reuse that link and that list; what they add is a decomposition planned up front instead of a follow-up discovered after the fact.

Nothing existing changes. An idea with phases stays exactly what it is, and old ideas are untouched. A board is a third structural `kind` alongside `note` and `fix`, declared when the entity is created so it can sit empty before it is decomposed — which is the real flow, since the shell is written first and split afterwards.

### The shape

`kind: board` marks the shell. It carries no phases: its tickets are its decomposition, and phases stay the unit inside each ticket. Its status is derived from its tickets the way a plan's status derives from its phases — every ticket done puts the board in `review`, never straight to `done`, since closing an entity stays a human promotion.

A ticket is `kind: ticket` with `idea:` pointing at its board, and it takes an id from its own `TICKET-N` counter in `config.json`. A distinct prefix is the point: a ticket and a top-level idea must not read identically in a list, and `TICKET-12` says what it is without a lookup. Nested ids like `IDEA-195-1` would show the relation in the id itself, but `KIND-<digits>` is assumed by the filename regex in `highestEntityIdOnDisk`, by `WIKILINK_RE` in the doctor, and by `IDEA_ID_RE` in the parser, and a per-kind counter no longer applies — too much machinery for a cosmetic gain.

The board's view lists its tickets with the same row treatment the main list uses — `PlanRows`, never the `Table` that renders phases — so a board reads as a scoped desk rather than a different product. Look is what carries over, not behaviour: a board can hold a strict order and offer its own actions where the main list filters and groups by subject. It never shows a phase table, because it has no phases. Phases appear only inside a ticket, or inside a small idea that was never split. Each ticket links back to its board the way a fix links back to its parent.

### First occupant

[[IDEA-195]] is the case that produced this. It is a `note`, so it has no phases, and its `### Sequencing` block is hand-numbered prose — which is why [[IDEA-117]] could claim to depend on "the first two steps" while nothing in the corpus enforced or tracked them. As a board, those five steps become five tickets with real ids, real status, and a real dependency [[IDEA-117]] can point at.

### Phases
- [x] Add `board` and `ticket` to the entity kinds
      Extend `EntityKind`, the frontmatter schema, and the `TICKET-N` counter in `config.json`; widen the doctor's wikilink check to resolve `[[TICKET-N]]`.
      run: 4m5s · 6.1k in · 8k out · sonnet-5
- [x] Suppress phases on a board and derive its status
      `PhasesSection` is not rendered for a board; roll its status up from its tickets, stopping at `review`.
      run: 8m45s · 950 in · 24.7k out · sonnet-5
- [x] Render a board's tickets in its view
      Reuse the main list's row treatment (`PlanRows`), scoped to the board, with the ticket-to-board backlink. Behaviour may diverge — strict order, board-specific actions — but the phases `Table` is never used here.
      run: 4m45s · 4.2k in · 8.7k out · sonnet-5
- [x] Create and decompose from the app
      Mark a new idea as a board, and add tickets to it without leaving its view.
- [x] Convert [[IDEA-195]] into a board
      Turn its five sequencing steps into tickets and repoint [[IDEA-117]]'s dependency at the real ids.
      run: 3m · 7.3k in · 13.6k out · sonnet-5

### Fixes
- [x] Hide tickets from the main plans list
      A ticket entity should render only inside its parent board's view, never as a row in the top-level worklist — it's decomposition detail, not a standalone list item.
      run: 3m7s · 7.8k in · 6k out · sonnet-5

### Thread
- [x] 2026-08-21 [chat] tickets should be rendered inside board. It is the list inside board, so no tickets should be visible in the main list
- [x] 2026-08-21 [chat] [agent] Got it — tickets should only ever show up inside their board's own list, not duplicated in the main worklist. Adding that as a fix here. (reopened this idea to re-run)
