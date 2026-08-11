---
id: IDEA-148
title: Bare mount URL white-screens the desk
type: fix
status: review
created: 2026-08-07
updated: 2026-08-11
tags:
  - integration
  - cli
  - app
subject: In-app dev toolbar
---

Reproduced against func-ui on `@dendelion/paper-camp@0.17.1`
(2026-08-07): "Open full desk" from the island white-screens. The chain:
the toolbar's desk link targets bare `/paper-camp` (no trailing slash);
the plugin serves the desk HTML there in place — 200, no redirect — and
the HTML's relative `./assets/main-*.js` then resolves against the
*host's* root, whose SPA fallback returns `index.html` as `text/html`;
the browser refuses the module script on MIME and nothing runs.
`/paper-camp/` works — which is why the pack smoke test stayed green;
it never requests the slash-less form. [[IDEA-132]]'s MIME failure,
reborn one directory up.

The fix is at the server, not in every caller:

1. **The plugin and CLI middleware redirect the bare mount path to the
   slash form** (`/paper-camp` → `/paper-camp/`, 308) so any entry —
   island link, bookmark, typed URL — lands where relative assets
   resolve.

2. **The island's desk link gains the trailing slash anyway** — no
   reason to take the redirect hop on the common path. The same link
   carries into [[IDEA-147]]'s Scout panel.

3. **The pack smoke test requests the bare path too** and asserts the
   redirect — the green-while-broken gap this shipped through.

### Phases
- [x] Redirect the bare mount path in the Vite plugin
      Serve a 308 from `/paper-camp` to `/paper-camp/` before the in-place HTML handler.
      run: 3m45s · 9.6k in · 8.5k out · sonnet-5
- [x] Redirect the bare mount path in the CLI middleware
      Mirror the plugin's 308 so packed/standalone serving lands on the slash form too.
- [x] Add the trailing slash to the island's desk link
      Point the toolbar's "Open full desk" link at `/paper-camp/` directly.
      run: 1m13s · 5.7k in · 2.6k out · sonnet-5
- [x] Cover the bare path in the pack smoke test
      Request `/paper-camp` and assert the 308 redirect to the slash form.
      run: 52s · 367 in · 1.8k out · sonnet-5

### Thread
- [x] 2026-08-07 [decision] Redirect at the serving layer is the fix; fixing only the link would leave every other slash-less entry broken. Smoke coverage must include the bare path.
- [ ] 2026-08-11 [question] [agent] Run-all parked on phase 2 ("Redirect the bare mount path in the CLI middleware") — the agent needs a decision: For phase 2 ("mirror the plugin's 308 in the CLI middleware"), what mount prefix should `dev-server.ts` redirect from/to, and how does it learn it — a new `--route`/config option (making the standalone server mount-aware for the first time, a bigger change than a redirect), or is there a different server/entry point you intend by "CLI middleware" that I'm missing?
