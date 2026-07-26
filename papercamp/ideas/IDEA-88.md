---
id: IDEA-88
title: Configurable title, branch, and agent
status: idea
created: 2026-07-25
updated: 2026-07-26
subject: Planning surface
---

An entity's identity is effectively frozen once created. The git branch is derived (`branchName(plan.id, plan.kind, plan.title)` in `src/app/server/git.ts`) with no override, so retitling silently diverges from the branch already holding the work, and there is no way to point an entity at a branch that already exists. The per-entity agent is settable through `PATCH /api/plans` (`agent`) but has no surface next to the rest of an entity's configuration.

Give each entity a small config surface: an editable title with the branch consequence made explicit, a branch override or selector over existing branches, and the per-entity agent/model choice in the same place.

Deliberately split from [[IDEA-87]] because this one touches git and can strand work on the wrong branch — it deserves its own gate and tests. `ensureBranch` was fixed on 2026-07-25 to branch off `origin/main` and surface real git errors instead of a fabricated fallback; a branch override should flow through that same path rather than around it.
