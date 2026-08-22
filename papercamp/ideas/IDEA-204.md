---
id: IDEA-204
title: Deploy the hosted client
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-21
updated: 2026-08-22
tags:
  - infrastructure
  - deployment
  - app
subject: Infrastructure
---

[[IDEA-195]] settles that the client is a static bundle on a CDN and that opening a URL is the front door. Nothing publishes that bundle today. This is the pipeline that does: a Vercel project building `vite build --config vite.app.config.ts`, production on `main` and a preview per pull request.

It stays a pure static deploy. No serverless function, no edge middleware, no environment secret — a backend is exactly what [[IDEA-193]] refuses, and the client holds nothing at build time that would need one. Vercel is a file host here and nothing more, which is also what keeps it replaceable.

Two things in the build were wrong for a CDN. `vite.app.config.ts` set `base: './'`, which suits a bundle served from a repo's own dev server but not a hosted root — at a nested route like `/ideas/195/tickets/2` a relative `./assets/…` resolves against the route and 404s. And the router uses browser history, so every deep link needs a rewrite to `index.html` or a refresh returns a 404. Both are settled in the repo: an absolute base, and a `vercel.json` rewriting everything but the static asset directories.

Nothing has to be configured at build time. [[TICKET-2]] already shipped the runtime connection: the client takes a runtime URL and pairing token from the query string a `paper-camp dev` announce prints, then remembers them per device. So the hosted bundle is identical to the local one and carries no environment of its own — which is what keeps this a file host and nothing more.

Local hosting is unaffected. `paper-camp dev` keeps serving the same bundle from inside a repo, as [[IDEA-195]] settles, so this adds a second origin rather than replacing the first.

### Phases
- [x] Make the bundle CDN-correct
      Absolute `base` so nested routes resolve their assets; `pnpm build:app` verified to emit `/assets/…` into `dist/app`.
- [x] Add the SPA rewrites
      `vercel.json` rewrites every path but `assets/`, `img/`, `fonts/` and `manifest.json` to `index.html`.
- [x] Create the Vercel project
      Point it at this repo with no functions and no environment variables; the committed `vercel.json` carries the build command, output directory and rewrites.
- [x] Confirm production and preview deploys
      `main` to production, a preview per pull request, and a deep link surviving a refresh.

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Third sequencing step; needs the detached bundle from TICKET-2 before there is anything to put on a CDN
