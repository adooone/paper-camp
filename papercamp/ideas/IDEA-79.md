---
id: IDEA-79
title: First-run experience
type: feat
status: idea
created: 2026-07-22
subject: Workflow
tags:
  - cli
  - scaffold
  - app
---

`init` produces a welcoming empty corpus: seeded example idea, empty states that teach ("No ideas yet — capture one or ask for suggestions"), and USAGE.md surfaced on first open.

From the roadmap: Horizon 1 — Ready for daily use.

### Phases
- [ ] Seed a welcoming example idea in `init`
      Have `initProject` (`src/core/scaffold/scaffold.ts`) write a first example entity via `formatEntityFile`, minting the `nextId.idea` counter, so a fresh corpus opens with one idea that models the format instead of an empty index. Keep init's no-clobber contract — never overwrite an already-initialized corpus.
- [ ] Rewrite empty states to teach
      Replace the terse "No plans yet" / "No plans pending review." / docs "Select a section" copy with next-action guidance ("No ideas yet — capture one or ask for suggestions"), pointing at the New idea button and the suggestions surface. Touch the Plans (`plans-page.tsx`), Review, and Docs empty states.
- [ ] Surface USAGE.md on first open
      Detect a fresh/near-empty corpus and route the dashboard's first open to `USAGE.md` (already in the `/api/docs` allowlist in `routes/reads.ts`) — auto-select it in Docs or nudge toward it — so the first thing a new user sees is how to use the tool.
- [ ] Gate the pass
      Run `tsc --noEmit`, `npx biome check . --write`, and `pnpm test` across the repo; smoke-test `init` in a fresh temp project to confirm the seeded example idea appears, the empty states read right once it's removed, and USAGE.md surfaces.
