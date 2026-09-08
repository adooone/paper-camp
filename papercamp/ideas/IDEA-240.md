---
id: IDEA-240
title: Ship no frontend in the npm package
type: feat
status: idea
created: 2026-09-06
tags:
  - cli
  - app
  - docs
subject: Packaging
order: 8
---

`@dendelion/paper-camp` ships the dashboard twice over. `package.json`'s
`files` includes all of `dist`, and `pnpm build` writes the app bundle into
`dist/app` beside the CLI, so every install carries the React bundle, the
fonts, and everything in `public/img`. `paper-camp dev` and `paper-camp
daemon` then serve that copy from `appDir()` in `serve-static.ts`, while the
same bundle is deployed to `https://paper-camp.vercel.app` by `vercel.json`
and is the client every Network, Tailnet, and Tunnel link already opens.

Two clients for one runtime is the wrong shape, and the packaged one is
what blocks the assets. The purchased doodle pack in `~/dev/box` may be used
in an end product but not redistributed, and [[IDEA-232]] traced both ways
it would leak: a committed file in the public repo, and `public/img` inside
the npm tarball. The answer then was to draw four illustrations by hand.
They were removed today; they are not the product's look.

The hosted client becomes the only frontend. The package ships the runtime.

**The tarball is CLI and server only.** `files` lists `dist/cli`,
`dist/core`, `dist/mcp`, `dist/vite`, and `templates`; a `prepack` script
runs `tsc && vite build` for the library and the toolbar and nothing else,
and `build:app` stays the Vercel build. `appDir()`, `loadIndexHtml`, and
`serveStatic` leave `serve-static.ts`; `pack-smoke-test.mjs` asserts no
`dist/app` in the tarball.

**The toolbar stays as it is.** `./vite` and `dist/toolbar` remain in the
package: the toolbar is the script a user's own app loads, and it is the
door to the dashboard. Its own icons — the inline `paper-logo.tsx` and the
`WandIcon` — are drawn in this repo, not taken from the pack, so they ship
freely; nothing from `public/img/doodles/` may ever be imported into
`src/toolbar`. Its trigger opens the hosted client at
`PAPERCAMP_HOSTED_CLIENT_URL` (default `https://paper-camp.vercel.app`) with
the app's own runtime in `?runtime=`, the same link the `dev` banner prints.

**`dev` and `daemon` serve the API and hand you the link.** Both banners
print a Local link that opens the hosted client with `?runtime=` (dev) or
`?machine=` (daemon) pointing at `http://localhost:<port>` and the pairing
token. Browsers treat loopback as trustworthy from an HTTPS page, which
`canReachRuntime` in `runtime-reachability.ts` already encodes, so the local
flow needs no tunnel. `GET /` on either server answers a 302 to that link,
so the old habit of opening `localhost:3333` still lands in the dashboard.
Other devices keep `--tailnet` and `--share` exactly as they are. The
`Version mismatch` stamp keeps its job: the hosted client is always the
latest release, a runtime may lag, and the stamp says so.

**Working on Paper Camp itself is unchanged.** `pnpm dev` runs the app from
source with the API as Vite middleware, as today; nothing in this idea
touches the clone path.

**The doodle pack lives outside git and outside the tarball.** A
`public/img/doodles/` folder is git-ignored. `scripts/fetch-assets.mjs`
downloads and unpacks it before `build:app` from the private URL in
`PAPERCAMP_ASSETS_URL`, set in the Vercel project and in each developer's
local env; the script skips quietly when the variable is absent so a clone
builds without the pack. The pack is then served only from the hosted
client, which is an end product, and never enters the repo or the package.

**Empty states get pack doodles.** `EmptyState` regains an `illustration`
slot, this time an `<img>` sized to a fixed 96px box from
`/img/doodles/<name>.svg`, with the same handwritten copy under it. The
seven empty states that had drawings today pick one each. A build without
the pack renders the copy alone.

**The docs say one client.** USAGE.md's install and "The hub" sections
describe the hosted client as the dashboard and the package as the runtime
that serves it; README.md's Quick Start matches.

### Out of scope

The toolbar's Scout behaviour and icons, unchanged beyond its link. Self-hosting
the client somewhere other than Vercel; `PAPERCAMP_HOSTED_CLIENT_URL`
already lets a runtime point at a different origin. Any change to pairing
or to the daemon's project mounts.

### Phases
- [x] Hand the hosted client link to `dev` and `daemon`
      Both banners print a Local link to `PAPERCAMP_HOSTED_CLIENT_URL` carrying `?runtime=`/`?machine=` and the pairing token, and `GET /` answers a 302 to it.
      run: 15s · 124 in · 32.1k out · sonnet-5
- [x] Open the hosted client from the toolbar trigger
      Same link shape, with the host app's own runtime origin in `?runtime=`.
      run: 5m43s · 38 in · 6.7k out · sonnet-5
- [x] Drop static serving from the servers
      `appDir()`, `loadIndexHtml`, and `serveStatic` leave `serve-static.ts` along with their tests; `dev-server.ts` and `daemon-server.ts` serve the API only.
      run: 8m22s · 110 in · 27.5k out · sonnet-5
- [x] Ship a runtime-only tarball
      `files` lists `dist/cli`, `dist/core`, `dist/mcp`, `dist/vite`, and `templates`; a `prepack` script builds the library and the toolbar; `build:app` stays the Vercel build and `pack-smoke-test.mjs` asserts no `dist/app`.
      run: 9m20s · 74 in · 16.2k out · sonnet-5
- [x] Fetch the doodle pack outside git
      Git-ignore `public/img/doodles/` and add `scripts/fetch-assets.mjs`, which unpacks `PAPERCAMP_ASSETS_URL` before `build:app` and skips quietly when the variable is absent.
      run: 9m48s · 50 in · 10.4k out · sonnet-5
- [x] Give `EmptyState` an `illustration` slot
      A 96px `<img>` from `/img/doodles/<name>.svg` above the existing copy; the seven empty states that had drawings each pick one, and a pack-less build renders the copy alone.
      run: 8m42s · 92 in · 19.7k out · sonnet-5
- [ ] Say one client in USAGE.md and README.md
