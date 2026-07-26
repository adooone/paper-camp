---
id: IDEA-88
title: Configurable title, branch, and agent
type: feat
status: idea
created: 2026-07-25
updated: 2026-07-26
tags:
  - git
  - plans
  - app
subject: Planning surface
order: 5
---

An entity's identity is effectively frozen once created. The git branch is derived (`branchName(plan.id, plan.kind, plan.title)` in `src/app/server/git.ts`) with no override, so retitling silently diverges from the branch already holding the work, and there is no way to point an entity at a branch that already exists. The per-entity agent is settable through `PATCH /api/plans` (`agent`) but has no surface next to the rest of an entity's configuration.

Give each entity a small config surface: an editable title with the branch consequence made explicit, a branch override or selector over existing branches, and the per-entity agent/model choice in the same place.

Deliberately split from [[IDEA-87]] because this one touches git and can strand work on the wrong branch — it deserves its own gate and tests. `ensureBranch` was fixed on 2026-07-25 to branch off `origin/main` and surface real git errors instead of a fabricated fallback; a branch override should flow through that same path rather than around it.

### Phases
- [ ] Add a `branch` override field to the entity schema
      Extend `entityFrontmatterSchema` in `src/core/parse/schemas.ts` and thread it through the parser, `readEntities`, and `entityToPlan` so an entity can carry an explicit branch that supersedes the derived `branchName(id, type, title)`.
- [ ] Make `ensureBranch` honour the override
      In `src/app/server/git.ts`, prefer the stored branch over `branchName(...)` while flowing through the same `origin/main` base and real-git-error path — never around it, so an override can't strand work off-main.
- [ ] List existing branches on the server
      Add a route/helper enumerating local and `origin` branches so the UI can offer a selector over branches that already hold work, not just a free-text override.
- [ ] Accept title and branch edits through `PATCH /api/plans`
      Extend the update payload to set the title and the branch override, keeping the branch-strand risk gated (block or warn when a retitle would diverge from a branch already holding commits).
- [ ] Build the entity config surface in `entity-detail.tsx`
      One place holding the editable title with its branch consequence made explicit, the branch override/selector over existing branches, and the per-entity agent/model choice.
- [ ] Type-check and full pass
      `pnpm run check-types`, `npx biome check . --write`, and `pnpm test` clean, with coverage for the override path through `ensureBranch`.
