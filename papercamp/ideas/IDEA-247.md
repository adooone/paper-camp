---
id: IDEA-247
title: Toolbar served from the daemon
type: feat
status: review
created: 2026-09-10
tags:
  - app
  - vite
  - cli
subject: In-app dev toolbar
order: 2
---

Putting the toolbar into another app is a hand job today, and it needs a
process the daemon already replaced. `src/vite/index.ts` proxies
`/paper-camp/*` on the host app's dev server to `127.0.0.1:<port>`, the
port from that repo's `papercamp/config.json`, which means a `paper-camp
dev` running per repo — while `paper-camp daemon` already serves the same
repo at `/p/<slug>` with its API and the toolbar bundle. And the plugin only
exists in a repo whose owner found it, added the package, edited the Vite
config, and started the extra process. Nothing in Paper Camp's own UI
mentions the toolbar, let alone turns it on.

**The plugin points at the daemon.** `paperCamp()` stops proxying. On
`configureServer` it reads the machine registry at
`~/.config/paper-camp/projects.json` (honouring `PAPERCAMP_CONFIG_DIR`),
finds the entry whose path is the Vite root, reads the daemon's port from
`daemon.json` beside it, and injects one script tag into the host's HTML:
`http://localhost:<port>/p/<slug>/toolbar.js`, with the mount as its route
attribute. The toolbar's own requests go straight to that origin; loopback
is a trusted host and the daemon already answers CORS for it. No daemon
running, or a root the registry does not know, prints one line at Vite
start — "paper-camp: toolbar off — run `paper-camp start` and register this
repo with `paper-camp init`" — and injects nothing. `port` stays as an
override for a runtime started by hand; the proxy and `mount` rewriting in
`src/vite/proxy.ts` are deleted.

**Settings has a Toolbar section.** Under Settings → *Toolbar*, for the
current project: a switch writing `integration.toolbar.enabled` to
`papercamp/config.json`, the route field writing `integration.route`, and
the state of the host app — the Vite config desk discovery found for the
frontend service, whether it imports `@dendelion/paper-camp/vite`, and
whether the package is a dependency. When either is missing the section
offers one action, *Install toolbar*, which launches an agent task with the
detected config path: add the package as a dev dependency with the
project's package manager, add the import and the `paperCamp()` call to the
plugins array, and commit. The section shows the task's card while it runs
and the installed state when it lands. No snippet to copy; the agent does
the edit, as every other fix in the app does.

**The toolbar knows which project it is.** The bundle reads its route
attribute for the mount and the daemon origin from its own script `src`,
so one bundle serves every mounted project without a build-time port.

### Out of scope

The toolbar's Scout features and its look. Production builds; the plugin
still applies to `vite serve` only. Host apps that are not Vite.

### Phases
- [x] Serve the toolbar bundle from the daemon
      `serveToolbarAsset` is wired into `src/cli/dev-server.ts` today; mount it under `/p/<slug>/` and answer CORS for loopback origins.
      run: 5m36s · 62 in · 23k out · sonnet-5
- [x] Resolve the daemon origin and slug in `paperCamp()`
      Match the Vite root against `projects.json`, read the port from `daemon.json`, keep `port` as a manual override.
      run: 5m13s · 46 in · 19.3k out · sonnet-5
- [x] Inject the script tag, or print the off notice
      run: 5m59s · 58 in · 23.8k out · sonnet-5
- [x] Delete `src/vite/proxy.ts` and its mount rewriting
      run: 3m11s · 32 in · 8.1k out · sonnet-5
- [x] Read the origin from the script `src` in the toolbar bundle
      run: 5m21s · 60 in · 18.8k out · sonnet-5
- [x] Add the Toolbar settings section
      Enable switch, route field, and host-app state from the frontend service's Vite config.
      run: 9m23s · 164 in · 37.8k out · sonnet-5
- [x] Launch the *Install toolbar* agent task from that section
      run: 11m16s · 234 in · 54.6k out · sonnet-5

### Fixes
- [ ] Resolve the toolbar for a Vite root inside a registered project
      `resolveDaemonTarget` in `src/vite/daemon-target.ts` matches the registry entry whose path equals the Vite root, so a monorepo app such as radio's `apps/admin` prints the off notice. Match the entry whose path contains the Vite root instead, and use its slug for the mount. Cover it in `daemon-target.test.ts`.
- [ ] Detect the host app from the frontend service, not the repo root
      `detectToolbarHostState` in `src/core/desk-discovery/toolbar-host.ts` looks for `vite.config.*` only at the project root, so Settings → Toolbar reports Not found for a monorepo and never offers Install. Look in the frontend desk service's working directory when the desk names one, else the first Vite config under `apps/*` or `packages/*`, else the root; report the path relative to the root, and pass that path to `buildInstallToolbarPrompt` so the agent edits the right config and adds the dependency to that app's `package.json`. Cover it in `toolbar-host.test.ts`.
- [ ] Remove the Route field and `integration.route`
      The plugin mounts at `/p/<slug>` and nothing reads `integration.route` any more. Drop the field from `toolbar-section.tsx` and `use-toolbar-section.ts`, the key and its validation from `src/app/server/routes/system/config.ts` and `src/cli/dev-port.ts`, the `route` member of `IntegrationConfig` in `src/types/index.ts`, and the tests that cover it.
- [ ] Make the install task land without a shell allowlist entry
      The agent runs headless in the host repo, whose scaffolded allowlist permits file edits but not `pnpm add`. In `buildInstallToolbarPrompt` tell the agent to add `@dendelion/paper-camp` to `devDependencies` by editing that app's `package.json` first, then run the package manager's install to update the lockfile, so the dependency is recorded even if the command is refused.
- [ ] Inject the script through Vite's tags API
      In `src/vite/index.ts`, return `{ html, tags: [{ tag: 'script', attrs: {...}, injectTo: 'body' }] }` from `transformIndexHtml` instead of replacing `</body>` by string, so an index without that tag still gets the toolbar. Update `index.test.ts`.
