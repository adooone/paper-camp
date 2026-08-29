---
id: IDEA-219
title: Hub screen scroll and repo picker
type: fix
created: 2026-08-29
updated: 2026-08-29
tags:
  - app
subject: Multi-project
---

The hub screen breaks as soon as it holds real content, measured live on the
hosted client (paper-camp.vercel.app/projects, 1456×840 viewport):

- **Nothing scrolls.** paper-ui's `Layout` is a viewport-locked shell by
  design — `layout`/`body`/`main`/`content` are all viewport height with
  `overflow: hidden`, and content areas are expected to own their scrolling
  (only the sidebar has `overflow-y: auto`). `HubShell`'s wrapper (`flex
  min-h-screen flex-col items-center justify-center`) provides no scroll
  container, so with a 14-repo connected card the content grew to 1621px
  while `scrollHeight` stayed pinned at the 843px viewport: everything below
  one screen is unreachable. Ten projects will hit the same wall.
- **Row controls render outside the card.** A long runtime label (a
  `trycloudflare.com` hostname) pushes its row past the Projects card: the
  card's right edge measured at x=969 with Rename ending at 1017 and the
  remove × at 1061 — both painted outside the border and the × effectively
  unreachable. The label span never shrinks: no `min-w-0`, no truncation.
- **The connected GitHub card is a dead list.** It renders every accessible
  repository as inert rows — nothing to click, no way to say which repos
  this hub is actually about, and long names (`croco-dendy/croco-react-…`)
  clip against the card edge.

The fix, all inside `src/app/features/hub`:

1. `HubShell`'s wrapper becomes the scroll container Layout expects:
   `h-full overflow-y-auto` with the parchment `Page` centered via `m-auto` —
   centered when short, top-anchored and fully scrollable when tall. No
   paper-ui change.
2. Project rows get shrink-safe layout: the label span takes `min-w-0` +
   `truncate` with the full value in `title`, the Rename/× buttons take
   `shrink-0`. Nothing paints outside the card at any label length.
3. The connected card becomes a repo picker. Header keeps the identity line
   and Disconnect. Below it: a search input filtering the accessible repos,
   in a list capped at five rows with its own `overflow-y-auto`. Each row is
   choosable; chosen repos form the hub's working set — shown at the top of
   the card as removable entries and persisted device-locally in a
   `hub-repo-store` (localStorage, beside the runtimes registry), the single
   source any hub view reads the repo list from instead of refetching
   everything accessible. Repo names truncate the owner half first.

### Out of scope

What a chosen repo unlocks beyond the card (cross-project views adopt the
working set separately). The pasted-token and device-flow auth paths.
paper-ui's `Layout` contract.

### Phases
- [x] Make the hub shell scrollable
      `h-full overflow-y-auto` wrapper with the Page on `m-auto`; verify a 25-row Projects card scrolls end to end and a short hub still centers.
      run: 36s · 14 in · 981 out · sonnet-5
- [x] Shrink-safe project rows
      `min-w-0` + `truncate` + `title` on labels, `shrink-0` on row buttons; verify with a trycloudflare-length hostname.
      run: 1m14s · 24 in · 4k out · sonnet-5
- [x] Add the hub-repo-store
      Device-local chosen-repo set in localStorage with add/remove/list, mirroring the runtimes registry pattern.
      run: 54s · 18 in · 3.6k out · sonnet-5
- [x] Turn the connected card into the repo picker
      Identity + Disconnect header, search over accessible repos, five-row scrollable list, chosen repos pinned on top as removable entries.
      run: 3m57s · 36 in · 7.1k out · sonnet-5
- [x] Run the app's quality checks
      run: 3m24s · 16 in · 1.1k out · sonnet-5
