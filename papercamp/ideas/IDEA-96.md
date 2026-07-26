---
id: IDEA-96
title: Open questions as a working queue
type: feat
status: idea
created: 2026-07-26
updated: 2026-07-26
tags:
  - app
  - plans
  - core
subject: Planning surface
order: 9
---

`papercamp/open-questions.md` holds 124 lines of unresolved questions that nothing in the app shows. The backend is already complete and orphaned: `GET /api/open-questions` parses them, and `POST /api/open-questions/resolve` takes `{decision, rationale}` — it already resolves a question *into* a decision. There is simply no UI calling any of it.

The history matters more than the gap. [[IDEA-19]] built a "resolve open questions from Docs" UI; [[IDEA-68]] then trimmed it as unused. So a browse page for this was tried and deleted, and rebuilding one would meet the same fate — a passive list is not something anyone visits.

Treat them as **work**, not reference. An open question blocks progress, so it belongs where work lives: a count wherever it would stop you, and the question itself surfaced against the entity it blocks rather than filed away in a docs section. Each one gets the resolve action that already exists, and answering it **promotes the question into a decision** — the same promote shape the app already runs for suggestions→ideas and roadmap→ideas. Because the endpoint is written, this is mostly wiring: the cheapest large win available here.

There is already a three-tier structure implicit in the corpus worth making explicit rather than inventing something new: a question about one entity lives in that entity's `### Clarifications` (exists, and already renders in `entity-detail.tsx`); a question that outlives one entity lives in `open-questions.md`; an answered question that now binds future work becomes a decision. Promotion runs one way — clarification → open question → decision.

Pairs with [[IDEA-97]], which handles the decision end of that chain. Do this one first; it is smaller and its endpoint already exists.

Open question for the plan: whether open questions should become per-file entities the way plans and ideas did in [[IDEA-20]], which would make them linkable and taggable like everything else in the corpus, or stay a single file given how few there are.

### Phases
- [ ] Settle the modelling question: per-file entities vs the single `open-questions.md`
      Decide whether questions stay one file or become per-file entities like [[IDEA-20]] did; the single file is the cheaper default given how few there are, so justify per-file only if linkability/tagging earns it. Everything below assumes the chosen shape.
- [ ] Surface an open-question count wherever it would stop you
      Add a blocking count to the worklist / Status surface driven by `GET /api/open-questions`, so questions show up where work lives rather than in a docs section.
- [ ] Surface each question against the entity it blocks
      Render an open question alongside the entity it targets in `entity-detail.tsx`, next to the existing `### Clarifications` rendering, instead of a standalone browse list.
- [ ] Wire the resolve action to the existing endpoint
      Call `POST /api/open-questions/resolve` with `{decision, rationale}` from the entity surface — mostly wiring, since the endpoint already resolves a question into a decision.
- [ ] Promote an answered question into a decision
      Reuse the promote shape the app already runs for suggestions→ideas and roadmap→ideas so resolving a question writes it into `decisions.md`, keeping promotion one-way (clarification → open question → decision).
- [ ] Add the clarification → open-question promotion step
      Let a question that outlives one entity's `### Clarifications` graduate into `open-questions.md`, completing the three-tier chain in one direction.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean across the repo.
