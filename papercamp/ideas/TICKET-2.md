---
id: TICKET-2
title: Detach the client
type: feat
kind: ticket
status: review
idea: IDEA-195
created: 2026-08-21
updated: 2026-08-22
tags:
  - client
  - build
  - runtime
subject: Multi-project
---

Most of detaching the client shipped with [[IDEA-193]] (PR #184): `src/app/services/runtime-connection.ts` reads a runtime URL and pairing token from the query string, `setApiBase` repoints every call, and `paper-camp dev` still serves the same bundle from its own origin. One gap is left, and it is the one that matters for a hub.

A URL carried in the query string dies with the tab. Nothing remembers which runtimes exist, so every visit starts from a pasted link and a single runtime is all the client can hold. Persisting them — the URL and its pairing token, per device — is what turns one dialled runtime into a registry, which is why [[IDEA-117]] builds on this rather than beside it.

### Phases
- [x] Persist a runtime and its pairing token device-locally
      Keep the runtime URL and token in browser storage rather than the query string, so a reload keeps the connection.
      run: 3m52s · 6.5k in · 8.8k out · sonnet-5
- [x] Select which runtime the client dials
      Let the client hold more than one and switch between them, which is the seam [[IDEA-117]] extends into a registry.
      run: 3m55s · 360 in · 12.4k out · sonnet-5
- [x] Adopt a runtime from a registration link
      Take the URL and token a `paper-camp dev` announce prints and store them, instead of requiring a hand-pasted query string.
      run: 4m5s · 647 in · 11.6k out · sonnet-5
- [x] [manual] Centralize entity navigation with useOpenEntity and entityLink

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Second named sequencing step; needs TICKET-1's pairing token and origin checks before the client can dial a runtime cross-origin
