---
id: TICKET-3
title: Capability-aware modules
type: feat
kind: ticket
idea: IDEA-195
status: idea
created: 2026-08-21
tags:
  - modules
  - capabilities
  - client
subject: Multi-project
---

Every module declares the layer it needs so the client composes from what is reachable — a sequencing step on [[IDEA-195]].

### Phases
- [ ] Define the layer-capability contract
      Give each module a declaration of which layers it needs — client, runtime, or a plugin — against the frozen surface from [[TICKET-1]].
- [ ] Resolve which layers are reachable
      Derive per-project reachability from connection state: runtime dialable, GitHub credential present, each plugin available.
- [ ] Gate modules on their declared layer
      Compose the app from what is reachable, so a module whose layer is absent is disabled in place rather than dropped.
- [ ] Show the in-place unavailable state
      Render a runtime-only module as visible-but-inert with a plain reason, so plan-only reads as a first-class state, not a broken one.
- [ ] Annotate existing modules with their layer
      Tag today's modules with their required layer and confirm plan-only surfaces the planning half while execution modules go inert.
