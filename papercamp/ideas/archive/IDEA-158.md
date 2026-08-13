---
id: IDEA-158
title: Build command in the desk Stack panel
type: feat
status: done
created: 2026-08-11
updated: 2026-08-13
tags:
  - app
  - checks
subject: In-app dev toolbar
order: 1
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
- [x] Expose the build check state to the desk
      Surface the `build` check's status and last-built time, kept out of the commit-gate check stamps.
      run: 2m5s · 6.1k in · 7.3k out · sonnet-5
- [x] Add a Build control to the Stack panel's desk section
      A trigger button plus the last-built timestamp, living under `src/app/components/stack-panel/`.
      run: 2m38s · 515 in · 11.7k out · sonnet-5
- [x] Wire the trigger to the build route
      Call `/api/status/check?name=build`, reflect the running state, and refresh on completion.
      run: 1m55s · 233 in · 8.7k out · sonnet-5
- [x] Handle the unconfigured case
      Show a clear message when `commands.build` is absent, distinct from a failed build.
      run: 1m27s · 363 in · 6.4k out · sonnet-5
- [x] Refresh last-built off the activity stream
      Update the timestamp from the SSE status tick so it stays live without a manual reload.
      run: 47s · 229 in · 2.9k out · sonnet-5

### Fixes
- [x] Compress the desk section layout around the Build control
      The Build control currently sits in its own card in the Stack panel's desk section, shifting the rest of the layout. Integrate it into the desk section's existing control grouping (alongside git actions etc.) instead of a standalone card, so the section stays visually compact and organized.
      run: 1m33s · 5.7k in · 6.8k out · sonnet-5
- [x] Fix the failing "Quality" check
      Fix the failing "Quality" check in this repo.
      run: 1m41s · 6k in · 4.2k out · sonnet-5

### Thread
- [x] 2026-08-13 [chat] the layout of the Stack panel is shifted because of new card with build. Think on how we can improve and compress the UI. To have all elements in Desk section naturally organised
- [x] 2026-08-13 [chat] [agent] Makes sense — the Build row landed as its own card and threw off spacing. I'll fold it into the desk's existing controls instead of keeping it a separate block, so the section reads as one organized group rather than a stack of cards. Added it as a fix here. (reopened this idea to re-run)
- [x] 2026-08-13 [log] [agent] IDEA-158 was reopened to fold the standalone Build card into the desk's existing controls, compressing the Stack panel layout.
