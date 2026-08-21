---
id: TICKET-1
title: Contract and auth
type: feat
kind: ticket
idea: IDEA-195
status: idea
created: 2026-08-21
tags:
  - runtime
  - http
  - security
subject: Multi-project
---

Freeze the runtime's HTTP surface, add pairing, origin checking on reads, CORS and the Private Network Access preflight — the first sequencing step on [[IDEA-195]].

### Phases
- [ ] Freeze the runtime's HTTP surface as a contract
      Pin the endpoint list, methods and response shapes the client depends on, so later phases and [[TICKET-2]] build against a stable surface.
- [ ] Emit CORS headers on every runtime response
      Today only Vite's preflight answers with `Access-Control-Allow-Origin`; the API's own responses carry none.
- [ ] Answer the Private Network Access preflight
      Reply to the CORS-PNA preflight a public https origin sends before reaching a loopback target.
- [ ] Extend origin checking to reads and allow-list the client origin
      `isForbiddenRequest` guards mutating methods only; apply it to reads too and pin the hosted client's exact origin.
- [ ] Add a pairing token established at announce time
      Issue the token when the runtime announces itself and require it alongside the origin check to distinguish the user's own client.
