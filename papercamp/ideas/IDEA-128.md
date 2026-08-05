---
id: IDEA-128
title: In-app dev toolbar — paper-camp living inside the target application
type: feat
status: idea
created: 2026-08-05
updated: 2026-08-05
tags:
  - integration
  - app
---

Owner's idea: integrate paper-camp natively into the application being built. When the target app's dev server runs, paper-camp is present *inside it* — a **docked toolbar** (Vercel-Toolbar-style) wired to the corpus and tools, a link out to the full desk, and optionally the whole desk mounted on a subroute of the app.

Prior art proves the pattern (Vercel Toolbar, Nuxt DevTools, React Query Devtools) — but none of them are a project brain. The differentiated loop is **capture-in-context**: you notice something while clicking through your own app, hit capture on the toolbar, type two sentences, and the idea lands in the corpus with the current route/URL attached.

Shape:

- **Reuse the desk's existing StatusBar** (`src/app/components/shell/status-bar.tsx` — "ambient status + immediate quick actions") rather than building a new component. Extract it into a shareable toolbar with two mounts: the desk shell as today, and the target app via the plugin. It already wires agent status, git state, quick commit, and setup gaps to the server API.
- In-app mount adds the app-specific segments: current focus (active idea/phase), quick capture with route context, parked-questions badge ([[IDEA-118]]), check/run status once [[IDEA-119]] lands, "open full desk" link. Docked to the bottom edge, collapsing to a pill when idle; segments expand into small panels above the bar.
- `@dendelion/paper-camp/vite` plugin, dev-only by default: injects the toolbar (shadow-DOM web component — framework-agnostic, immune to host CSS) and mounts the desk at `/__camp` via middleware proxying to the paper-camp server (`config.port`), which also avoids CORS by staying same-origin.
- Config: an `integration: { toolbar, route }` block in `papercamp/config.json` (the declarative-manifest direction), toggleable in Settings for frontend targets.
- **Not** on production URLs by default — corpus + agent controls in a deployed app is a security footgun. Remote access belongs to Horizon 3's remote/hosted mode; the toolbar links there instead of embedding. Opt-in + authed for internal deployments at most.
- Non-Vite consumers later via thin adapters (any dev server that can proxy).

Blocked until the StatusBar isolation ([[IDEA-129]]) lands — the toolbar builds on its extracted core.

### Log
- 2026-08-05 — Decision (owner): toolbar form factor over the corner icon-bubble — a docked bar with segments, Vercel-Toolbar-style.
- 2026-08-05 — Decision (owner): reuse the desk's existing StatusBar as the base — one toolbar component, two mounts (desk shell + injected in-app), not a parallel implementation.
