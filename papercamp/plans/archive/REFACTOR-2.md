---
id: REFACTOR-2
title: UI cleanup follow-up
kind: refactor
status: done
created: 2026-06-19
updated: 2026-06-21
tags:
  - app
  - ui
  - refactor
---

Findings from testing the "UI cleanup" plan's implementation live in the browser plus a
source-level pass over the same files. Two are real, user-visible bugs; the rest are loose
ends the cleanup pass introduced or left behind while fixing the things it set out to fix.

### Phases
- [x] Fix nav island content overlap
      Fix content bleeding into the bottom nav island: on long markdown bodies (e.g. the "Paper Camp" idea detail), scrolled-to-bottom text renders in the same vertical band as the fixed nav island. `router.tsx`'s `layout.pagePaddingBottom` (3rem/48px) doesn't clear the nav island's actual footprint (`navIslandBottom` offset + the island's own height, ~88-112px) — increase the clearance or derive it from the island's real height instead of a flat token
- [x] Add loading states to docs sections
      Fix the Docs page's "Repo Docs" section flashing "No repo docs found" before the fetch resolves, then correctly populating — indistinguishable from genuinely-empty during the flash. Settings already does this right (shows "Loading…" for Project Info); match that pattern for Decisions/Open Questions/Progress/Repo Docs too
- [x] Wire up loading flags
      Wire up the `loading` flag `useProjectIdentity()` already returns — none of its 5 call sites (`router.tsx`, `docs-sidebar.tsx`, `plans-sidebar.tsx`, `settings-sidebar.tsx`, `settings-page.tsx`) destructure it, so the hook can't prevent the flash-of-empty-state class of bug it was built to help with. Same dead-flag pattern as the unused `*Loading` fields already in `app-store.ts` — fix both in the same pass
- [x] Normalize font size tokens
      Normalize `tokens.ts`'s `fontSize` scale: collapse the 4 near-duplicate `-alt` entries (`xs-alt`/`sm-alt`/`base-alt`/`md-alt`, each within 0.025–0.1rem of a canonical sibling) into the single clean scale `CODE_STYLE.md` calls for, updating call sites to the nearest canonical value
- [x] Add required file input comment
      Add the inline comment `CODE_STYLE.md` itself requires next to the raw `<input type="file">` in `settings-page.tsx` — the style guide documents this as a known gap but the code doesn't carry the comment it mandates
- [x] Remove dead utility CSS rules
      Remove the dead `.btn-blue`/`.btn-red` rules in `utilities.css` — no `.tsx` file references either class; only `.btn-green`/`.btn-orange`/`.btn-violet` are ever used
- [x] Add AGENTS.md phase rule
      Add an `AGENTS.md` rule requiring assistants to complete only the explicitly requested phase of a plan at a time, so future agents don't over-implement across phase boundaries
