---
id: IDEA-139
title: Desk is broken under the mount — router basepath, API base, and a friendlier route
type: fix
status: idea
created: 2026-08-06
tags:
  - integration
  - app
  - cli
subject: In-app dev toolbar
---

Found reviewing v0.15.0 embedded in func-ui: "Open full desk" now loads the
desk shell at `/__camp/` (the [[IDEA-132]] relative-assets fix works), but
the page is unusable there. Two mount bugs and one naming decision:

1. **SPA router has no basepath.** `src/app/router.tsx` builds
   `createRouter({ routeTree })` with routes rooted at `/`, so under
   `/__camp/` nothing matches and the content pane renders "Not Found".
   The router needs a mount-aware `basepath` (derived from the serving
   prefix — e.g. `document.baseURI` or injected at serve time), staying `/`
   for the standalone desk on the camp port.

2. **Desk data layer misses the mount prefix.** Under `/__camp/` the desk's
   StatusBar shows "no branch · clean" and Deliver shows "No changed files"
   — its `/api/...` calls resolve against the host app's origin and silently
   fail, exactly the class of bug [[IDEA-132]] fixed for the toolbar bundle.
   The desk build's `apiUrl` base must be mount-aware too (same derivation
   as the router basepath), not only the toolbar's.

3. **Rename the route: `/__camp` → `/paper-camp`.** Owner decision: no
   dunder-technical URLs — use a plain, readable pattern
   (`/paper-camp`, `/paper-camp/plans/...`). The default changes in the vite
   plugin (`CAMP_ROUTE`), the toolbar (`DEFAULT_ROUTE`), and docs;
   `integration.route` in config.json keeps working as the override, and the
   plugin should tolerate the old default for existing configs.

### Thread
- [x] 2026-08-06 [decision] Route pattern is `/paper-camp/...` — simple URLs, no lowdash-prefixed technical routes.

### Phases
- [x] Derive the mount prefix once
      A single mount-aware helper the router and desk data layer both read, staying `/` for the standalone camp port.
- [ ] Give the SPA router a mount-aware basepath
      Pass the derived prefix as `basepath` in `src/app/router.tsx` so routes resolve under the mount.
- [ ] Make the desk build's apiUrl base mount-aware
      Prefix desk `/api/...` calls with the mount so StatusBar and Deliver hit the right origin.
- [ ] Rename the default route to `/paper-camp`
      Change `CAMP_ROUTE` in the vite plugin and `DEFAULT_ROUTE` in the toolbar; keep `integration.route` as the override and tolerate the old `/__camp` default.
- [ ] Update docs and verify under the mount
      Refresh route references in docs and confirm the desk works both standalone and embedded.
