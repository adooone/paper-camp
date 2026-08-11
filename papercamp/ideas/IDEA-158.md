---
id: IDEA-158
title: Build command in the desk Stack panel
type: feat
status: idea
created: 2026-08-11
tags:
  - app
  - checks
subject: In-app dev toolbar
---

Follow-up [[IDEA-157]] flagged but didn't build: a manual **Build** action —
trigger a build, see last-built time — surfaced in the **desk's own Stack
panel** (`src/app/components/stack-panel/`), not the embedded Scout.

IDEA-157 was implemented in the wrong place: the Build row landed in the
Scout card (the in-app toolbar embed) instead. Owner correction — Scout's
glance card should hold only idea-scoped data and actions (id, status,
phase, progress, open-in-desk link); git actions and Build don't belong
there. The Scout-side Build UI has been removed (`use-build-client.ts`
hook deleted, the row pulled from `scout-card.tsx`); the git actions grid
added alongside it was removed too, same reasoning.

What's still standing and reusable: the backend from IDEA-157 — `build` as
a config-driven `CheckName` in the status manager (`src/app/server/status.ts`),
the `/api/status/check?name=build` route, and `commands.build` in
`papercamp/config.json` typed on `PaperCampConfig`. No default command; a
project that hasn't configured one gets a clear failure message; not part
of the commit gate. This idea is just the surfacing — same data, desk UI.

Owner will refine scope/phases later; deliberately left undrafted.
