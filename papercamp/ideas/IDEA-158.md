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

### Phases
- [ ] Expose the build check state to the desk
      Surface the `build` check's status and last-built time, kept out of the commit-gate check stamps.
- [ ] Add a Build control to the Stack panel's desk section
      A trigger button plus the last-built timestamp, living under `src/app/components/stack-panel/`.
- [ ] Wire the trigger to the build route
      Call `/api/status/check?name=build`, reflect the running state, and refresh on completion.
- [ ] Handle the unconfigured case
      Show a clear message when `commands.build` is absent, distinct from a failed build.
- [ ] Refresh last-built off the activity stream
      Update the timestamp from the SSE status tick so it stays live without a manual reload.
