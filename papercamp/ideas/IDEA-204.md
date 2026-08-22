---
id: IDEA-204
title: Deploy the hosted client
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-21
updated: 2026-08-21
tags:
  - infrastructure
  - deployment
  - app
subject: Infrastructure
---

[[IDEA-195]] settles that the client is a static bundle on a CDN and that opening a URL is the front door. Nothing publishes that bundle today. This is the pipeline that does: a Vercel project building `vite build --config vite.app.config.ts`, production on `main` and a preview per pull request.

It stays a pure static deploy. No serverless function, no edge middleware, no environment secret — a backend is exactly what [[IDEA-193]] refuses, and the client holds nothing at build time that would need one. Vercel is a file host here and nothing more, which is also what keeps it replaceable.

Three things in the current build are wrong for a CDN and are the real work. `vite.app.config.ts` sets `base: './'`, which suits a bundle served from a repo's own dev server but not a hosted root. The router uses browser history with a `basepath`, so every deep link needs a rewrite to `index.html` or a refresh on `/plans/IDEA-117` returns a 404. And the bundle currently resolves the API against its own origin; `setApiBase` already exists to repoint it, so the hosted build must set it from configuration rather than assume same-origin — the client half of [[IDEA-193]]'s detach phase.

Local hosting is unaffected. `paper-camp dev` keeps serving the same bundle from inside a repo, as [[IDEA-195]] settles, so this adds a second origin rather than replacing the first.

### Phases
- [ ] Make the bundle CDN-correct
      Resolve `base` for a hosted root, and confirm the locally served build still works from its own origin.
- [ ] Add the Vercel project and SPA rewrites
      Static build, no functions; rewrite unmatched paths to `index.html` so deep links and refreshes resolve.
- [ ] Point the hosted build at a runtime URL
      Drive `setApiBase` from configuration instead of assuming same-origin.
- [ ] Wire production and preview deploys
      `main` to production, a preview per pull request.

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Third sequencing step; needs the detached bundle from TICKET-2 before there is anything to put on a CDN
