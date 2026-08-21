---
id: TICKET-2
title: Detach the client
type: feat
kind: ticket
status: idea
idea: IDEA-195
created: 2026-08-21
tags:
  - client
  - build
  - runtime
subject: Multi-project
order: 10
---

Ship the bundle as an artifact taking a runtime URL — the second sequencing step on [[IDEA-195]].

### Phases
- [ ] Point the client at an explicit runtime URL
      Replace every same-origin API assumption with a runtime base URL the client reads, so the bundle no longer presumes it was served from the repo it drives.
- [ ] Build the client as a standalone static artifact
      Produce a CDN-ready bundle decoupled from the repo dev server, against the frozen surface from [[TICKET-1]].
- [ ] Persist and select the runtime URL device-locally
      Keep the loopback URL and its pairing token in browser storage, per device, and let the client pick which runtime it dials.
- [ ] Dial the runtime cross-origin with the pairing token
      Send the pairing token and satisfy the CORS and Private Network Access surface TICKET-1 adds.
- [ ] Keep `paper-camp dev` serving the same bundle
      Verify local hosting still works as the same artifact from a different origin, needing no transport change.

### Thread
- [x] 2026-08-21 [log] [agent] Run order: Second named sequencing step; needs TICKET-1's pairing token and origin checks before the client can dial a runtime cross-origin
