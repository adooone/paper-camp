---
id: IDEA-132
title: Published toolbar is dead on arrival — v0.14.0 embed fails end-to-end
type: fix
status: idea
created: 2026-08-05
tags:
  - integration
  - app
  - cli
subject: In-app dev toolbar
---

Field report from wiring `@dendelion/paper-camp@0.14.0` into a real Vite consumer
(func-ui): the [[IDEA-128]] toolbar never appears. The plugin side works — the
script tag is injected and `/__camp` proxies JSON and SSE correctly — but the
toolbar payload itself is unshippable as published. Four independent failures,
in the order they bite:

1. **The CLI server never serves the toolbar assets.** `paper-camp dev`
   (`src/cli/dev-server.ts`) serves statics only from `dist/app/`, but the lib
   build emits the bundle to `dist/toolbar.js` with helpers in `dist/chunks/`
   and `dist/types/`. `/__camp/toolbar.js` therefore hits the SPA fallback and
   returns `index.html` as `text/html` — the browser refuses the module script
   with a MIME error and nothing renders. Silent failure, no console hint
   beyond the MIME line.

2. **The published bundle cannot run in a browser anyway.** It is a lib-mode
   artifact, not an app artifact:
   - top-level `import { create } from "zustand"` — bare specifier, explicitly
     externalized in `vite.config.ts`; unresolvable in a browser.
   - relative imports into `./chunks/` and `./types/` — unreachable through the
     `dist/app/` static root even if the entry were served.
   - 10 unsubstituted `process.env.NODE_ENV` references (lib mode leaves them
     for a downstream bundler) — `ReferenceError: process is not defined`.
   - react/react-dom bundling silently depends on peer resolution at publish
     time — rollup treats an unresolved peer as external with only a warning.

3. **The panels' data layer is host-origin.** The toolbar reuses the desk's
   hooks, which hardcode same-origin paths (`use-status-client.ts`,
   `use-focus-client.ts`: `new EventSource('/api/activity/stream')`;
   `fetchConfig` likewise). Embedded, those resolve against the *host app's*
   origin, not the camp server — every fetch gets the host's `index.html` back
   ("Unexpected token '<' … is not valid JSON"), Focus shows "no active plan"
   regardless of corpus state, and no panel has data. The proxy path works
   (`/__camp/api/plans` and the SSE stream verified through the mount), so the
   fix is entirely client-side: the mount must inject an API base (route
   prefix) that the [[IDEA-129]] thin client honours — the shipped code never
   grew that seam.

4. **"Open full desk" at `/__camp` is broken too.** `dist/app/index.html`
   references its assets host-absolute (`/assets/main-*.js`, `/img/…`,
   `/manifest.json`), so under the mount the browser requests them from the
   host root, bypassing the proxy. The desk build needs a relative `base`
   (or the plugin must rewrite the HTML when proxying).

Verified working end-to-end with a locally patched bundle (self-contained
build: no externals, `define: { 'process.env.NODE_ENV' }`, dropped into
`dist/app/toolbar.js`): shadow-DOM bar renders in the consumer, idle-pill
collapse/expand behaves, segments draw — only the data layer (3) and desk
deep-link (4) remain broken, which is what isolates them as separate bugs.

Fix direction: build the toolbar as a browser app artifact, not a lib entry —
own build pass with everything bundled, NODE_ENV defined, single file emitted
to `dist/app/toolbar.js` so the existing static server covers it; inject the
camp route into the element (attribute set by the plugin's injected tag) and
thread it through the thin client as the fetch/EventSource base; set the desk
build's `base` to `'./'`. A release smoke test that curls
`/__camp/toolbar.js` through a packed tarball would have caught 1, 2, and 4.

### Phases
- [x] Add a browser build pass for the toolbar
      Own Vite pass with no externals, NODE_ENV defined, react/react-dom bundled, emitting a single self-contained `dist/app/toolbar.js`.
- [x] Inject the camp route as an element attribute
      Have the plugin's injected script tag set the API base on the mount element so the toolbar knows the camp origin.
- [x] Thread the API base through the thin client
      Give the desk hooks (`use-status-client`, `use-focus-client`, `fetchConfig`) a route-prefix seam and honour the injected base for every fetch/EventSource.
- [x] Set the desk build `base` to `'./'`
      Make `dist/app/index.html` reference its assets relatively so "Open full desk" resolves through the `/__camp` proxy.
- [ ] Add a packed-tarball smoke test
      Pack the lib, boot `paper-camp dev`, and curl `/__camp/toolbar.js` to assert it serves as JS — catches the serve/build/base regressions.
